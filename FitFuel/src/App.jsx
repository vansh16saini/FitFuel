import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- Firebase Configuration for Vercel Deployment ---
// IMPORTANT: Replace these placeholder values with your actual Firebase project configuration.
// You can find these values in your Firebase project settings (Project settings -> Your apps -> Web app).
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCZKBhknt81hm0HpuMwI1Mpar80WfXmxyQ",
  authDomain: "fitfuel-c363e.firebaseapp.com",
  projectId: "fitfuel-c363e",
  storageBucket: "fitfuel-c363e.firebasestorage.app",
  messagingSenderId: "720970554589",
  appId: "1:720970554589:web:6a0ba8dd50b17ea39f0f34",
  measurementId: "G-T06FM3TZXL" // e.g., "1:234567890:web:abcdef123456"
};

// This APP_ID is used for structuring your data in Firestore (e.g., /artifacts/{appId}/...).
// You can choose any unique string for your application.
const APP_ID = "fitfuel-vercel-app"; // A unique identifier for your app's data in Firestore


// Initialize Firebase outside the component to prevent re-initialization
let app;
let db;
let auth;

try {
    app = initializeApp(FIREBASE_CONFIG);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (error) {
    console.error("Firebase initialization failed:", error);
    // You might want to display a user-friendly error message here
}


// Main App component
const App = () => {
    // --- State Management ---
    const [meals, setMeals] = useState([]);
    const [workouts, setWorkouts] = useState([]);
    const [waterCount, setWaterCount] = useState(0);
    const hydrationGoal = 8; // glasses

    // State for meal input fields
    const [mealName, setMealName] = useState('');
    const [mealCalories, setMealCalories] = useState('');
    const [mealProtein, setMealProtein] = useState('');
    const [mealCarbs, setMealCarbs] = useState('');
    const [mealFats, setMealFats] = useState('');

    // State for workout input fields
    const [workoutName, setWorkoutName] = useState('');
    const [workoutDuration, setWorkoutDuration] = useState('');

    // State for custom modal
    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [modalType, setModalType] = useState('alert'); // 'alert' or 'confirm'
    const [onModalConfirm, setOnModalConfirm] = useState(null);

    // Firebase Auth and User ID state
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false); // To ensure Firestore operations wait for auth

    // State for login/signup forms
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [isLoginMode, setIsLoginMode] = useState(true); // true for login, false for signup
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    // --- Firebase Authentication Listener ---
    useEffect(() => {
        if (!auth) {
            console.error("Firebase Auth not initialized. Cannot set up auth listener.");
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                console.log("User signed in:", user.uid);
                setShowAuthModal(false); // Close auth modal on successful login
            } else {
                // If no user is signed in, try to sign in anonymously
                // This ensures there's always a user context for data operations,
                // even before explicit login/signup.
                try {
                    await signInAnonymously(auth);
                    console.log("Signed in anonymously.");
                } catch (error) {
                    console.error("Authentication error:", error);
                    showCustomAlert("Failed to sign in anonymously. Some features may not work.");
                }
            }
            setIsAuthReady(true); // Auth state is now determined
        });

        return () => unsubscribe(); // Cleanup subscription on unmount
    }, []); // Empty dependency array means this runs once on component mount

    // --- Firestore Data Loading (Meals, Workouts, Hydration) ---
    useEffect(() => {
        // We check for `db` and `auth` here, but they are stable references
        // initialized outside the component. `isAuthReady` and `userId` are
        // the actual states that trigger re-fetching data.
        if (!isAuthReady || !userId) {
            // Wait for authentication to be ready and userId to be set
            return;
        }

        // --- Meals Listener ---
        const mealsDocRef = doc(db, `artifacts/${APP_ID}/users/${userId}/meals`, 'userMeals');
        const unsubscribeMeals = onSnapshot(mealsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMeals(data.items || []);
            } else {
                setMeals([]); // No meals data yet
            }
        }, (error) => {
            console.error("Error fetching meals:", error);
        });

        // --- Workouts Listener ---
        const workoutsDocRef = doc(db, `artifacts/${APP_ID}/users/${userId}/workouts`, 'userWorkouts');
        const unsubscribeWorkouts = onSnapshot(workoutsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setWorkouts(data.items || []);
            } else {
                setWorkouts([]); // No workouts data yet
            }
        }, (error) => {
            console.error("Error fetching workouts:", error);
        });

        // --- Hydration Listener ---
        const hydrationDocRef = doc(db, `artifacts/${APP_ID}/users/${userId}/hydration`, 'userHydration');
        const unsubscribeHydration = onSnapshot(hydrationDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setWaterCount(data.count || 0);
            } else {
                setWaterCount(0); // No hydration data yet
            }
        }, (error) => {
            console.error("Error fetching hydration:", error);
        });

        // Cleanup function for all listeners
        return () => {
            unsubscribeMeals();
            unsubscribeWorkouts();
            unsubscribeHydration();
        };
    }, [isAuthReady, userId]); // Removed 'db' from dependencies as it's a stable reference

    // --- Custom Modal Functions ---
    const showCustomAlert = (message) => {
        setModalMessage(message);
        setModalType('alert');
        setShowModal(true);
        setOnModalConfirm(null); // Clear any previous confirm callback
    };

    const showCustomConfirm = (message, callback) => {
        setModalMessage(message);
        setModalType('confirm');
        setShowModal(true);
        setOnModalConfirm(() => callback); // Store callback
    };

    const closeModal = () => {
        setShowModal(false);
        setModalMessage('');
        setModalType('alert');
        setOnModalConfirm(null);
    };

    const handleModalConfirm = () => {
        if (onModalConfirm) {
            onModalConfirm();
        }
        closeModal();
    };

    // --- Authentication Handlers ---
    const handleEmailSignup = async () => {
        setAuthLoading(true);
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            showCustomAlert("Account created successfully! You are now logged in.");
            setEmail('');
            setPassword('');
        } catch (error) {
            console.error("Signup error:", error);
            showCustomAlert(`Signup failed: ${error.message}`);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleEmailLogin = async () => {
        setAuthLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            showCustomAlert("Logged in successfully!");
            setEmail('');
            setPassword('');
        } catch (error) {
            console.error("Login error:", error);
            showCustomAlert(`Login failed: ${error.message}`);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setAuthLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            showCustomAlert("Logged in with Google successfully!");
        } catch (error) {
            console.error("Google login error:", error);
            showCustomAlert(`Google login failed: ${error.message}`);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = async () => {
        if (auth) {
            try {
                await signOut(auth);
                setUserId(null); // Clear user ID on logout
                setMeals([]); // Clear local data on logout
                setWorkouts([]);
                setWaterCount(0);
                showCustomAlert("You have been logged out.");
            } catch (error) {
                console.error("Error signing out:", error);
                showCustomAlert("Failed to log out. Please try again.");
            }
        }
    };

    // --- Meal Planner Logic ---
    const handleAddMeal = async () => {
        const caloriesNum = parseInt(mealCalories);
        const proteinNum = parseInt(mealProtein);
        const carbsNum = parseInt(mealCarbs);
        const fatsNum = parseInt(mealFats);

        if (mealName.trim() && !isNaN(caloriesNum) && !isNaN(proteinNum) && !isNaN(carbsNum) && !isNaN(fatsNum)) {
            const newMeal = {
                name: mealName.trim(),
                calories: caloriesNum,
                protein: proteinNum,
                carbs: carbsNum,
                fats: fatsNum
            };
            const updatedMeals = [...meals, newMeal];
            setMeals(updatedMeals); // Optimistic UI update

            if (userId && db) {
                try {
                    await setDoc(doc(db, `artifacts/${APP_ID}/users/${userId}/meals`, 'userMeals'), { items: updatedMeals });
                } catch (e) {
                    console.error("Error adding meal to Firestore: ", e);
                    showCustomAlert("Failed to save meal. Please try again.");
                    setMeals(meals); // Revert UI if save fails
                }
            }

            // Clear form fields
            setMealName('');
            setMealCalories('');
            setMealProtein('');
            setMealCarbs('');
            setMealFats('');
        } else {
            showCustomAlert('Please fill in all meal details correctly.');
        }
    };

    const handleDeleteMeal = (indexToDelete) => {
        showCustomConfirm('Are you sure you want to delete this meal?', async () => {
            const updatedMeals = meals.filter((_, index) => index !== indexToDelete);
            setMeals(updatedMeals); // Optimistic UI update

            if (userId && db) {
                try {
                    await setDoc(doc(db, `artifacts/${APP_ID}/users/${userId}/meals`, 'userMeals'), { items: updatedMeals });
                } catch (e) {
                    console.error("Error deleting meal from Firestore: ", e);
                    showCustomAlert("Failed to delete meal. Please try again.");
                    setMeals(meals); // Revert UI if save fails
                }
            }
        });
    };

    const handleEditMeal = (indexToEdit) => {
        const mealToEdit = meals[indexToEdit];
        if (mealToEdit) {
            // Populate the form with current meal data for editing
            setMealName(mealToEdit.name);
            setMealCalories(mealToEdit.calories);
            setMealProtein(mealToEdit.protein);
            setMealCarbs(mealToEdit.carbs);
            setMealFats(mealToEdit.fats);

            // Remove the meal from the array (it will be re-added with changes)
            // This also triggers a Firestore update via handleDeleteMeal's logic if it were integrated,
            // but for a simple edit, we'll just remove it from local state and expect "Add Meal" to re-save.
            setMeals(prevMeals => prevMeals.filter((_, index) => index !== indexToEdit));
            // Note: A more robust edit would involve a dedicated "Update Meal" button and logic.
            showCustomAlert('Meal details loaded into form for editing. Make changes and click "Add Meal" again.');
        }
    };

    // --- Workout Planner Logic ---
    const handleAddWorkout = async () => {
        const durationNum = parseInt(workoutDuration);

        if (workoutName.trim() && !isNaN(durationNum) && durationNum > 0) {
            const newWorkout = {
                name: workoutName.trim(),
                duration: durationNum
            };
            const updatedWorkouts = [...workouts, newWorkout];
            setWorkouts(updatedWorkouts); // Optimistic UI update

            if (userId && db) {
                try {
                    await setDoc(doc(db, `artifacts/${APP_ID}/users/${userId}/workouts`, 'userWorkouts'), { items: updatedWorkouts });
                } catch (e) {
                    console.error("Error adding workout to Firestore: ", e);
                    showCustomAlert("Failed to save workout. Please try again.");
                    setWorkouts(workouts); // Revert UI if save fails
                }
            }

            // Clear form fields
            setWorkoutName('');
            setWorkoutDuration('');
        } else {
            showCustomAlert('Please enter a valid workout name and duration.');
        }
    };

    const handleDeleteWorkout = (indexToDelete) => {
        showCustomConfirm('Are you sure you want to delete this workout?', async () => {
            const updatedWorkouts = workouts.filter((_, index) => index !== indexToDelete);
            setWorkouts(updatedWorkouts); // Optimistic UI update

            if (userId && db) {
                try {
                    await setDoc(doc(db, `artifacts/${APP_ID}/users/${userId}/workouts`, 'userWorkouts'), { items: updatedWorkouts });
                } catch (e) {
                    console.error("Error deleting workout from Firestore: ", e);
                    showCustomAlert("Failed to delete workout. Please try again.");
                    setWorkouts(workouts); // Revert UI if save fails
                }
                }
        });
    };

    // --- Hydration Tracker Logic ---
    const handleIncreaseWater = async () => {
        const newWaterCount = waterCount + 1;
        setWaterCount(newWaterCount); // Optimistic UI update

        if (userId && db) {
            try {
                await setDoc(doc(db, `artifacts/${APP_ID}/users/${userId}/hydration`, 'userHydration'), { count: newWaterCount });
            } catch (e) {
                console.error("Error updating hydration in Firestore: ", e);
                showCustomAlert("Failed to update hydration. Please try again.");
                setWaterCount(waterCount); // Revert UI if save fails
            }
        }
    };

    const handleDecreaseWater = async () => {
        if (waterCount > 0) {
            const newWaterCount = waterCount - 1;
            setWaterCount(newWaterCount); // Optimistic UI update

            if (userId && db) {
                try {
                    await setDoc(doc(db, `artifacts/${APP_ID}/users/${userId}/hydration`, 'userHydration'), { count: newWaterCount });
                } catch (e) {
                    console.error("Error updating hydration in Firestore: ", e);
                    showCustomAlert("Failed to update hydration. Please try again.");
                    setWaterCount(waterCount); // Revert UI if save fails
                }
            }
        }
    };

    const hydrationProgress = (waterCount / hydrationGoal) * 100;

    // Render a loading state or login prompt if auth is not ready
    if (!isAuthReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-xl font-semibold text-gray-700">Loading FitFuel...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="bg-gradient-to-r from-green-500 to-blue-500 text-white p-4 shadow-lg rounded-b-xl">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-3xl font-bold">FitFuel</h1>
                    <nav className="flex items-center space-x-4">
                        <ul className="flex space-x-4">
                            <li><a href="#meal-planner" className="hover:underline">Meals</a></li>
                            <li><a href="#workout-planner" className="hover:underline">Workouts</a></li>
                            <li><a href="#hydration-tracker" className="hover:underline">Hydration</a></li>
                            <li><a href="#weekly-planner" className="hover:underline">Weekly</a></li>
                        </ul>
                        {userId ? (
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2 bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm">
                                    <span className="font-medium">User ID:</span>
                                    <span className="truncate max-w-[100px] sm:max-w-none">{userId}</span>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition duration-300 ease-in-out shadow-md"
                                >
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowAuthModal(true)}
                                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition duration-300 ease-in-out shadow-md"
                            >
                                Login / Sign Up
                            </button>
                        )}
                    </nav>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="container mx-auto p-4 flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Meal Planner Section */}
                <section id="meal-planner" className="bg-white p-6 rounded-lg shadow-md lg:col-span-2">
                    <h2 className="text-2xl font-semibold mb-4 text-green-700">Meal Planner</h2>
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h3 className="text-xl font-medium mb-3">Add New Meal</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label htmlFor="mealName" className="block text-sm font-medium text-gray-700 mb-1">Meal Name</label>
                                <input
                                    type="text"
                                    id="mealName"
                                    placeholder="e.g., Chicken Salad"
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                    value={mealName}
                                    onChange={(e) => setMealName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="mealCalories" className="block text-sm font-medium text-gray-700 mb-1">Calories (kcal)</label>
                                <input
                                    type="number"
                                    id="mealCalories"
                                    placeholder="e.g., 450"
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                    value={mealCalories}
                                    onChange={(e) => setMealCalories(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="mealProtein" className="block text-sm font-medium text-gray-700 mb-1">Protein (g)</label>
                                <input
                                    type="number"
                                    id="mealProtein"
                                    placeholder="e.g., 30"
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                    value={mealProtein}
                                    onChange={(e) => setMealProtein(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="mealCarbs" className="block text-sm font-medium text-gray-700 mb-1">Carbs (g)</label>
                                <input
                                    type="number"
                                    id="mealCarbs"
                                    placeholder="e.g., 40"
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                    value={mealCarbs}
                                    onChange={(e) => setMealCarbs(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="mealFats" className="block text-sm font-medium text-gray-700 mb-1">Fats (g)</label>
                                <input
                                    type="number"
                                    id="mealFats"
                                    placeholder="e.g., 15"
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                    value={mealFats}
                                    onChange={(e) => setMealFats(e.target.value)}
                                />
                            </div>
                        </div>
                        <button onClick={handleAddMeal} className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition duration-300 ease-in-out shadow-md">Add Meal</button>
                    </div>

                    <h3 className="text-xl font-medium mb-3">Your Meals</h3>
                    <div id="mealList" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {meals.length === 0 ? (
                            <p className="text-gray-500 col-span-full">No meals added yet. Add your first meal!</p>
                        ) : (
                            meals.map((meal, index) => (
                                <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                    <h4 className="font-semibold text-lg mb-1">{meal.name}</h4>
                                    <p className="text-sm text-gray-600">Calories: {meal.calories} kcal</p>
                                    <p className="text-sm text-gray-600">Protein: {meal.protein}g | Carbs: {meal.carbs}g | Fats: {meal.fats}g</p>
                                    <div className="mt-3 flex space-x-2">
                                        <button onClick={() => handleEditMeal(index)} className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600">Edit</button>
                                        <button onClick={() => handleDeleteMeal(index)} className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600">Delete</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Right Sidebar / Other Sections */}
                <aside className="lg:col-span-1 space-y-6">
                    {/* Workout Planner Section */}
                    <section id="workout-planner" className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-2xl font-semibold mb-4 text-blue-700">Workout Planner</h2>
                        <div className="mb-4">
                            <label htmlFor="workoutName" className="block text-sm font-medium text-gray-700 mb-1">Workout Name</label>
                            <input
                                type="text"
                                id="workoutName"
                                placeholder="e.g., Strength Training"
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                value={workoutName}
                                onChange={(e) => setWorkoutName(e.target.value)}
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="workoutDuration" className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                            <input
                                type="number"
                                id="workoutDuration"
                                placeholder="e.g., 60"
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                value={workoutDuration}
                                onChange={(e) => setWorkoutDuration(e.target.value)}
                                />
                            </div>
                            <button onClick={handleAddWorkout} className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-300 ease-in-out shadow-md">Add Workout</button>
                            <div id="workoutList" className="mt-4 space-y-2">
                                {workouts.length === 0 ? (
                                    <p className="text-gray-500 text-sm">No workouts added yet.</p>
                                ) : (
                                    workouts.map((workout, index) => (
                                        <div key={index} className="bg-gray-50 p-3 rounded-md border border-gray-200 flex justify-between items-center">
                                            <div>
                                                <h4 className="font-medium">{workout.name}</h4>
                                                <p className="text-sm text-gray-600">Duration: {workout.duration} mins</p>
                                            </div>
                                            <button onClick={() => handleDeleteWorkout(index)} className="bg-red-500 text-white px-2 py-1 rounded-md text-xs hover:bg-red-600">Delete</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        {/* Hydration Tracker Section */}
                        <section id="hydration-tracker" className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-2xl font-semibold mb-4 text-teal-700">Hydration Tracker</h2>
                            <div className="flex items-center justify-center space-x-4 mb-4">
                                <button onClick={handleDecreaseWater} className="bg-teal-500 text-white p-3 rounded-full text-2xl hover:bg-teal-600 transition duration-300 ease-in-out shadow-md">-</button>
                                <div className="text-4xl font-bold text-teal-800" id="waterCount">{waterCount}</div>
                                <span className="text-xl text-gray-600">glasses</span>
                                <button onClick={handleIncreaseWater} className="bg-teal-500 text-white p-3 rounded-full text-2xl hover:bg-teal-600 transition duration-300 ease-in-out shadow-md">+</button>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                                <div
                                    id="hydrationProgressBar"
                                    className={`h-4 rounded-full ${hydrationProgress <= 100 ? 'bg-teal-500' : 'bg-green-600'}`}
                                    style={{ width: `${Math.min(hydrationProgress, 100)}%` }}
                                ></div>
                            </div>
                            <p className="text-center text-sm text-gray-600">Goal: {hydrationGoal} glasses</p>
                        </section>

                        {/* Weekly Planner (Placeholder for now) */}
                        <section id="weekly-planner" className="bg-white p-6 rounded-lg shadow-md">
                            <h2 className="text-2xl font-semibold mb-4 text-purple-700">Weekly Planner</h2>
                            <p className="text-gray-600">This section will display your weekly meal and workout schedule.</p>
                            <div className="mt-4 bg-gray-50 p-4 rounded-md border border-gray-200 h-48 overflow-y-auto">
                                {/* Weekly grid content will go here */}
                                <p className="text-sm text-gray-500">Coming soon: A visual grid for your weekly plan!</p>
                            </div>
                        </section>
                    </aside>
                </main>

                {/* Footer */}
                <footer className="bg-gray-800 text-white p-4 text-center mt-6 rounded-t-xl">
                    <p>&copy; 2025 FitFuel. All rights reserved.</p>
                </footer>

                {/* Custom Modal */}
                {showModal && (
                    <div id="customModal" className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
                            <p className="text-lg font-medium text-gray-800 mb-4">{modalMessage}</p>
                            <div className="flex justify-end space-x-3">
                                {modalType === 'alert' && (
                                    <button onClick={closeModal} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition duration-300">OK</button>
                                )}
                                {modalType === 'confirm' && (
                                    <>
                                        <button onClick={closeModal} className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400 transition duration-300">Cancel</button>
                                        <button onClick={handleModalConfirm} className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition duration-300">Confirm</button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Authentication Modal */}
                {showAuthModal && (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
                            <h2 className="text-2xl font-semibold mb-4 text-center">{isLoginMode ? 'Login' : 'Sign Up'}</h2>

                            <div className="flex justify-center mb-6">
                                <button
                                    onClick={() => setIsLoginMode(true)}
                                    className={`px-4 py-2 rounded-l-md font-medium ${isLoginMode ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                >
                                    Login
                                </button>
                                <button
                                    onClick={() => setIsLoginMode(false)}
                                    className={`px-4 py-2 rounded-r-md font-medium ${!isLoginMode ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                >
                                    Sign Up
                                </button>
                            </div>

                            <input
                                type="email"
                                placeholder="Email"
                                className="w-full p-3 mb-4 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                className="w-full p-3 mb-6 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />

                            {isLoginMode ? (
                                <button
                                    onClick={handleEmailLogin}
                                    className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition duration-300 ease-in-out shadow-md mb-3"
                                    disabled={authLoading}
                                >
                                    {authLoading ? 'Logging In...' : 'Login'}
                                </button>
                            ) : (
                                <button
                                    onClick={handleEmailSignup}
                                    className="w-full bg-purple-600 text-white py-3 px-4 rounded-md hover:bg-purple-700 transition duration-300 ease-in-out shadow-md mb-3"
                                    disabled={authLoading}
                                >
                                    {authLoading ? 'Signing Up...' : 'Sign Up'}
                                </button>
                            )}

                            <div className="relative flex items-center justify-center my-4">
                                <div className="flex-grow border-t border-gray-300"></div>
                                <span className="flex-shrink mx-4 text-gray-500">OR</span>
                                <div className="flex-grow border-t border-gray-300"></div>
                            </div>

                            <button
                                onClick={handleGoogleLogin}
                                className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 transition duration-300 ease-in-out shadow-md flex items-center justify-center space-x-2"
                                disabled={authLoading}
                            >
                                <svg className="w-5 h-5" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M44.5 24.0086C44.5 22.0622 44.3218 20.1706 43.9806 18.3429H24.4996V29.4925H35.7952C35.2536 32.3276 33.6288 34.7671 31.2007 36.4385V43.167H40.0039C45.1637 38.4526 48 31.6022 48 24.0086C48 19.2604 46.9944 14.8093 45.1979 10.8719L38.4879 5.86206L30.9575 11.536C33.1537 16.5173 34.25 22.0086 34.25 27.5086C34.25 33.0086 33.1537 38.5086 30.9575 43.4899L38.4879 49.1639L45.1979 44.154C46.9944 40.2166 48 35.7655 48 31.0173C48 28.3618 47.4944 25.6173 46.5 23.0086H44.5Z" fill="#FFC107"/>
                                    <path d="M24.4996 48C31.1396 48 36.8396 45.7486 40.0039 43.167L31.2007 36.4385C29.1415 37.8188 26.8282 38.8354 24.4996 38.8354C19.9575 38.8354 16.0396 36.1914 14.1288 32.3276L5.32561 39.0561C9.07172 44.2709 16.2082 48 24.4996 48Z" fill="#34A853"/>
                                    <path d="M14.1288 32.3276C13.2982 30.1314 12.8354 27.8182 12.8354 25.4996C12.8354 23.181 13.2982 20.8678 14.1288 18.6716L5.32561 11.9431C1.5795 17.1579 0 23.0086 0 29.0086C0 35.0086 1.5795 40.8593 5.32561 46.0741L14.1288 39.3456C16.0396 35.4818 19.9575 32.8378 24.4996 32.8378L14.1288 32.3276Z" fill="#4285F4"/>
                                    <path d="M24.4996 9.1646C26.8282 9.1646 29.1415 10.1812 30.9575 11.536L38.4879 5.86206C36.8396 3.28043 34.1396 1.1646 30.9575 0C26.8282 0 23.0086 2.64406 20.4996 6.5086L24.4996 9.1646Z" fill="#EA4335"/>
                                </svg>
                                <span>Sign in with Google</span>
                            </button>

                            <button
                                onClick={() => setShowAuthModal(false)}
                                className="w-full mt-4 bg-gray-300 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-400 transition duration-300 ease-in-out shadow-md"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

export default App;
