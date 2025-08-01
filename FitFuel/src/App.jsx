import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// Global Firebase configuration and initialization
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCZKBhknt81hm0HpuMwI1Mpar80WfXmxyQ",
    authDomain: "fitfuel-c363e.firebaseapp.com",
    projectId: "fitfuel-c363e",
    storageBucket: "fitfuel-c363e.firebasestorage.app",
    messagingSenderId: "720970554589",
    appId: "1:720970554589:web:6a0ba8dd50b17ea39f0f34",
    measurementId: "G-T06FM3TZXL"
};

const APP_ID = "fitfuel-vercel-app";
const __app_id = APP_ID; // Use for Firestore paths

let app;
let db;
let auth;
let firebaseConfig;
try {
    firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : JSON.stringify(FIREBASE_CONFIG));
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (error) {
    console.error("Firebase initialization failed:", error);
}

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
    const [editingMealIndex, setEditingMealIndex] = useState(null);

    // State for workout input fields
    const [workoutName, setWorkoutName] = useState('');
    const [workoutDuration, setWorkoutDuration] = useState('');
    const [editingWorkoutIndex, setEditingWorkoutIndex] = useState(null);

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
            setIsAuthReady(true);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                console.log("User signed in:", user.uid);
                setShowAuthModal(false);
            } else {
                try {
                    const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                    if (token) {
                        await signInWithCustomToken(auth, token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Authentication error:", error);
                    showCustomAlert("Failed to sign in anonymously. Some features may not work.");
                }
            }
            setIsAuthReady(true);
        });

        return () => unsubscribe();
    }, [auth]);

    // --- Firestore Data Loading (Meals, Workouts, Hydration) ---
    useEffect(() => {
        if (!isAuthReady || !userId) {
            return;
        }

        // --- Meals Listener ---
        const mealsDocRef = doc(db, `artifacts/${APP_ID}/users/${userId}/meals`, 'userMeals');
        const unsubscribeMeals = onSnapshot(mealsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMeals(data.items || []);
            } else {
                setMeals([]);
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
                setWorkouts([]);
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
                setWaterCount(0);
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
    }, [isAuthReady, userId]);

    // --- Custom Modal Functions ---
    const showCustomAlert = (message) => {
        setModalMessage(message);
        setModalType('alert');
        setShowModal(true);
        setOnModalConfirm(null);
    };

    const showCustomConfirm = (message, callback) => {
        setModalMessage(message);
        setModalType('confirm');
        setShowModal(true);
        setOnModalConfirm(() => callback);
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
            showCustomConfirm('Are you sure you want to log out?', async () => {
                try {
                    await signOut(auth);
                    setUserId(null);
                    setMeals([]);
                    setWorkouts([]);
                    setWaterCount(0);
                    showCustomAlert("You have been logged out.");
                } catch (error) {
                    console.error("Error signing out:", error);
                    showCustomAlert("Failed to log out. Please try again.");
                }
            });
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
            let updatedMeals;
            if (editingMealIndex !== null) {
                updatedMeals = [...meals];
                updatedMeals[editingMealIndex] = newMeal;
                setEditingMealIndex(null);
            } else {
                updatedMeals = [...meals, newMeal];
            }

            if (userId && db) {
                try {
                    // Update Firestore, the onSnapshot listener will update the local state
                    await setDoc(doc(db, `artifacts/${APP_ID}/users/${userId}/meals`, 'userMeals'), { items: updatedMeals });
                } catch (e) {
                    console.error("Error adding/editing meal to Firestore: ", e);
                    showCustomAlert("Failed to save meal. Please try again.");
                }
            }

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

            if (userId && db) {
                try {
                    // Update Firestore, the onSnapshot listener will update the local state
                    await setDoc(doc(db, `artifacts/${APP_ID}/users/${userId}/meals`, 'userMeals'), { items: updatedMeals });
                } catch (e) {
                    console.error("Error deleting meal from Firestore: ", e);
                    showCustomAlert("Failed to delete meal. Please try again.");
                }
            }
        });
    };

    const handleEditMeal = (indexToEdit) => {
        const mealToEdit = meals[indexToEdit];
        if (mealToEdit) {
            setMealName(mealToEdit.name);
            setMealCalories(mealToEdit.calories);
            setMealProtein(mealToEdit.protein);
            setMealCarbs(mealToEdit.carbs);
            setMealFats(mealToEdit.fats);
            setEditingMealIndex(indexToEdit);
            showCustomAlert('Meal details loaded for editing. Modify the form and click "Update Meal".');
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
            let updatedWorkouts;
            if (editingWorkoutIndex !== null) {
                updatedWorkouts = [...workouts];
                updatedWorkouts[editingWorkoutIndex] = newWorkout;
                setEditingWorkoutIndex(null);
            } else {
                updatedWorkouts = [...workouts, newWorkout];
            }

            if (userId && db) {
                try {
                    // Update Firestore, the onSnapshot listener will update the local state
                    await setDoc(doc(db, `artifacts/${APP_ID}/users/${userId}/workouts`, 'userWorkouts'), { items: updatedWorkouts });
                } catch (e) {
                    console.error("Error adding/editing workout to Firestore: ", e);
                    showCustomAlert("Failed to save workout. Please try again.");
                }
            }

            setWorkoutName('');
            setWorkoutDuration('');
        } else {
            showCustomAlert('Please enter a valid workout name and duration.');
        }
    };

    const handleDeleteWorkout = (indexToDelete) => {
        showCustomConfirm('Are you sure you want to delete this workout?', async () => {
            const updatedWorkouts = workouts.filter((_, index) => index !== indexToDelete);

            if (userId && db) {
                try {
                    // Update Firestore, the onSnapshot listener will update the local state
                    await setDoc(doc(db, `artifacts/${APP_ID}/users/${userId}/workouts`, 'userWorkouts'), { items: updatedWorkouts });
                } catch (e) {
                    console.error("Error deleting workout from Firestore: ", e);
                    showCustomAlert("Failed to delete workout. Please try again.");
                }
            }
        });
    };

    const handleEditWorkout = (indexToEdit) => {
        const workoutToEdit = workouts[indexToEdit];
        if (workoutToEdit) {
            setWorkoutName(workoutToEdit.name);
            setWorkoutDuration(workoutToEdit.duration);
            setEditingWorkoutIndex(indexToEdit);
            showCustomAlert('Workout details loaded for editing. Modify the form and click "Update Workout".');
        }
    };

    // --- Hydration Tracker Logic ---
    const handleUpdateWater = async (change) => {
        if (!userId || !db) {
            showCustomAlert("Please log in to track your hydration.");
            return;
        }

        const newCount = waterCount + change;
        if (newCount >= 0) {
            const hydrationDocRef = doc(db, `artifacts/${APP_ID}/users/${userId}/hydration`, 'userHydration');
            try {
                // We only write to Firestore. The onSnapshot listener will update the state and the UI.
                await setDoc(hydrationDocRef, { count: newCount });
            } catch (e) {
                console.error("Error updating hydration in Firestore: ", e);
                showCustomAlert("Failed to update hydration. Please try again.");
            }
        }
    };

    const hydrationProgress = (waterCount / hydrationGoal) * 100;

    // A cybernetic loading screen with a glitch effect
    if (!isAuthReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-cyan-400 p-4 font-mono relative overflow-hidden">
                {/* Glitchy background effect */}
                <div className="absolute inset-0 bg-repeat opacity-5" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"100\" height=\"100\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M100 0H0V100H100V0Z M50 50H0V0H50V50Z\" fill=\"%2338bdf8\" fill-opacity=\"0.1\"/%3E%3C/svg%3E')"}}></div>
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="text-center animate-pulse">
                        <div className="glitch-text text-5xl font-extrabold" data-text="LOADING">LOADING</div>
                        <p className="mt-4 text-sm tracking-widest text-zinc-500">SYSTEM.ACCESSING_BIO-FEED.INITIATING_PROTOCOL</p>
                    </div>
                </div>
                <style jsx>{`
                    .glitch-text {
                        position: relative;
                        color: #00e5ff;
                        text-shadow: 0.05em 0 0 #ff00e5, -0.05em -0.025em 0 #00ff00, 0.025em 0.05em 0 #0000ff;
                        animation: glitch 1s infinite;
                    }
                    @keyframes glitch {
                        0% { text-shadow: 0.05em 0 0 #ff00e5, -0.05em -0.025em 0 #00ff00, 0.025em 0.05em 0 #0000ff; }
                        25% { text-shadow: -0.05em -0.025em 0 #ff00e5, 0.05em 0 0 #00ff00, -0.025em -0.05em 0 #0000ff; }
                        50% { text-shadow: 0.05em 0.025em 0 #ff00e5, -0.05em 0 0 #00ff00, -0.025em 0.05em 0 #0000ff; }
                        75% { text-shadow: -0.05em -0.025em 0 #ff00e5, 0.05em -0.025em 0 #00ff00, 0.025em 0.05em 0 #0000ff; }
                        100% { text-shadow: 0.05em 0 0 #ff00e5, -0.05em -0.025em 0 #00ff00, 0.025em 0.05em 0 #0000ff; }
                    }
                `}</style>
            </div>
        );
    }

    // Common input styling class for the theme
    const inputStyle = "w-full p-3 bg-zinc-800 bg-opacity-70 text-cyan-400 border border-zinc-700 rounded-lg placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition duration-200 font-mono";
    const sectionHeaderStyle = "text-3xl font-extrabold text-cyan-400 mb-6 tracking-wide border-b border-zinc-700 pb-2 relative after:absolute after:bottom-0 after:left-0 after:w-1/4 after:h-0.5 after:bg-gradient-to-r after:from-purple-500 after:to-transparent";

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans antialiased relative overflow-hidden">
            {/* Cybernetic Grid Background */}
            <div className="fixed inset-0 z-0 opacity-10 bg-[size:20px_20px]" style={{
                backgroundImage: "linear-gradient(to right, #1f2937 1px, transparent 1px), linear-gradient(to bottom, #1f2937 1px, transparent 1px)"
            }}></div>
            <div className="fixed inset-0 z-0 opacity-5 bg-[size:40px_40px]" style={{
                backgroundImage: "linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)",
                backgroundPosition: "0 0"
            }}></div>
            <div className="fixed inset-0 z-0 animate-pulse-slow" style={{ boxShadow: '0 0 100px 50px rgba(59, 130, 246, 0.1) inset' }}></div>

            {/* Main content wrapper */}
            <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <header className="flex justify-between items-center mb-8 py-4 px-6 bg-zinc-900 bg-opacity-70 backdrop-blur-sm rounded-lg border border-zinc-800 shadow-lg">
                    <a href="#" className="flex items-center space-x-4 group">
                        <span className="text-4xl font-extrabold text-white tracking-wider font-mono transition-all duration-300 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-cyan-400 group-hover:to-purple-500">
                            FITFUEL
                        </span>
                    </a>
                    <div className="flex items-center space-x-4">
                        {userId && (
                            <div className="text-sm text-zinc-400 font-mono flex items-center">
                                <span className="mr-2 hidden md:inline">UID:</span>
                                <span className="truncate max-w-[100px] sm:max-w-none text-zinc-300">{userId}</span>
                            </div>
                        )}
                        {!userId ? (
                            <button
                                onClick={() => setShowAuthModal(true)}
                                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2 px-6 rounded-md shadow-md hover:shadow-lg transition duration-200 transform hover:scale-105"
                            >
                                Login
                            </button>
                        ) : (
                            <button
                                onClick={handleLogout}
                                className="bg-zinc-700 text-red-400 font-bold py-2 px-6 rounded-md shadow-md hover:bg-zinc-600 transition duration-200 transform hover:scale-105"
                            >
                                Logout
                            </button>
                        )}
                    </div>
                </header>

                {/* Main Content Sections - Now using sm breakpoint for a wider range of laptops */}
                <div className="grid grid-cols-1 sm:grid-cols-[3fr_2fr] gap-8">
                    {/* Meal Planner Section (60%) */}
                    <div className="p-8 bg-zinc-900 bg-opacity-70 backdrop-blur-md rounded-2xl border-4 border-dashed border-zinc-700 shadow-xl transition-all duration-300 hover:border-cyan-500">
                        <h2 id="meal-planner" className={sectionHeaderStyle}>MEAL PLANNER</h2>

                        {/* Meal Input Form */}
                        <div className="p-6 bg-zinc-800 bg-opacity-50 rounded-xl border border-zinc-700 mb-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                <div className="col-span-full sm:col-span-1 lg:col-span-1">
                                    <label htmlFor="mealName" className="text-xs text-zinc-400 uppercase font-mono">Meal</label>
                                    <input type="text" id="mealName" placeholder="CYBER-NOODLES" value={mealName} onChange={(e) => setMealName(e.target.value)} className={inputStyle} />
                                </div>
                                <div>
                                    <label htmlFor="mealCalories" className="text-xs text-zinc-400 uppercase font-mono">KCAL</label>
                                    <input type="number" id="mealCalories" placeholder="450" value={mealCalories} onChange={(e) => setMealCalories(e.target.value)} className={inputStyle} />
                                </div>
                                <div>
                                    <label htmlFor="mealProtein" className="text-xs text-zinc-400 uppercase font-mono">PROTEIN</label>
                                    <input type="number" id="mealProtein" placeholder="30g" value={mealProtein} onChange={(e) => setMealProtein(e.target.value)} className={inputStyle} />
                                </div>
                                <div>
                                    <label htmlFor="mealCarbs" className="text-xs text-zinc-400 uppercase font-mono">CARBS</label>
                                    <input type="number" id="mealCarbs" placeholder="40g" value={mealCarbs} onChange={(e) => setMealCarbs(e.target.value)} className={inputStyle} />
                                </div>
                                <div>
                                    <label htmlFor="mealFats" className="text-xs text-zinc-400 uppercase font-mono">FATS</label>
                                    <input type="number" id="mealFats" placeholder="15g" value={mealFats} onChange={(e) => setMealFats(e.target.value)} className={inputStyle} />
                                </div>
                            </div>
                            <button
                                onClick={handleAddMeal}
                                className="w-full mt-6 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-cyan-500/50 transition duration-300"
                            >
                                {editingMealIndex !== null ? 'UPDATE MEAL' : 'ADD MEAL'}
                            </button>
                        </div>

                        {/* Meals List */}
                        <div className="mt-8 space-y-4">
                            <h3 className="text-xl font-bold text-pink-400 mb-2">LOGGED MEALS</h3>
                            {meals.length === 0 ? (
                                <p className="text-zinc-500 font-mono text-sm">NO DATA. INPUT REQUIRED.</p>
                            ) : (
                                meals.map((meal, index) => (
                                    <div key={index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-zinc-800 bg-opacity-50 border-2 border-dashed border-zinc-700 rounded-xl transition-all duration-300 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20">
                                        <div className="flex-grow">
                                            <h4 className="font-bold text-lg text-cyan-400 tracking-wider mb-1">{meal.name}</h4>
                                            <p className="text-sm text-zinc-400 font-mono">
                                                KCAL: <span className="text-white">{meal.calories}</span> | PROTEIN: <span className="text-white">{meal.protein}g</span> | CARBS: <span className="text-white">{meal.carbs}g</span> | FATS: <span className="text-white">{meal.fats}g</span>
                                            </p>
                                        </div>
                                        <div className="flex space-x-2 mt-4 sm:mt-0">
                                            <button onClick={() => handleEditMeal(index)} className="bg-zinc-700 text-blue-400 px-3 py-2 rounded-md text-xs font-mono transition duration-200 hover:bg-blue-900/50">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>EDIT
                                            </button>
                                            <button onClick={() => handleDeleteMeal(index)} className="bg-zinc-700 text-red-400 px-3 py-2 rounded-md text-xs font-mono transition duration-200 hover:bg-red-900/50">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>DEL
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Workout Planner and Hydration Section (40%) */}
                    <div className="flex flex-col space-y-8">
                        {/* Hydration Tracker Section */}
                        <div className="p-8 bg-zinc-900 bg-opacity-70 backdrop-blur-md rounded-2xl border-4 border-dashed border-zinc-700 shadow-xl transition-all duration-300 hover:border-cyan-500">
                            <h2 id="hydration-tracker" className={sectionHeaderStyle}>HYDRATION LOG</h2>
                            <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-6">
                                <div className="flex items-center space-x-4 w-full sm:w-auto justify-center">
                                    <button onClick={() => handleUpdateWater(-1)} className="bg-zinc-800 text-red-400 p-4 rounded-full text-3xl font-mono border border-red-400 transition duration-200 hover:bg-red-900/50 hover:shadow-lg hover:shadow-red-400/20 transform hover:scale-110">-</button>
                                    <div className="text-7xl font-extrabold text-white font-mono">{waterCount}</div>
                                    <span className="text-xl text-zinc-500 font-mono">/ {hydrationGoal}</span>
                                    <button onClick={() => handleUpdateWater(1)} className="bg-zinc-800 text-cyan-400 p-4 rounded-full text-3xl font-mono border border-cyan-400 transition duration-200 hover:bg-cyan-900/50 hover:shadow-lg hover:shadow-cyan-400/20 transform hover:scale-110">+</button>
                                </div>
                                <div className="w-full sm:w-1/2 flex-grow">
                                    <div className="w-full bg-zinc-800 rounded-full h-4 relative overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${hydrationProgress >= 100 ? 'from-green-500 to-teal-500' : 'from-cyan-500 to-purple-500'}`}
                                            style={{ width: `${Math.min(hydrationProgress, 100)}%` }}
                                        ></div>
                                        <div className="absolute inset-0 border border-zinc-700 rounded-full"></div>
                                    </div>
                                    <p className="text-center text-sm text-zinc-500 mt-2 font-mono">HYDRATION STATUS: <span className="text-white">{Math.min(hydrationProgress, 100)}% COMPLETE</span></p>
                                </div>
                            </div>
                        </div>

                        {/* Workout Planner Section */}
                        <div className="p-8 bg-zinc-900 bg-opacity-70 backdrop-blur-md rounded-2xl border-4 border-dashed border-zinc-700 shadow-xl transition-all duration-300 hover:border-purple-500">
                            <h2 id="workout-planner" className={sectionHeaderStyle}>WORKOUT PROTOCOL</h2>
                            <div className="p-6 bg-zinc-800 bg-opacity-50 rounded-xl border border-zinc-700 mb-6">
                                <h3 className="text-lg font-bold text-pink-400 mb-4 font-mono">ADD NEW WORKOUT</h3>
                                <label htmlFor="workoutName" className="text-xs text-zinc-400 uppercase font-mono">Workout Name</label>
                                <input type="text" id="workoutName" placeholder="VECTOR-STRENGTH" className={`${inputStyle} mb-4`} value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} />
                                <label htmlFor="workoutDuration" className="text-xs text-zinc-400 uppercase font-mono">Duration (mins)</label>
                                <input type="number" id="workoutDuration" placeholder="60" className={inputStyle} value={workoutDuration} onChange={(e) => setWorkoutDuration(e.target.value)} />
                                <button
                                    onClick={handleAddWorkout}
                                    className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-pink-500/50 transition duration-300"
                                >
                                    {editingWorkoutIndex !== null ? 'UPDATE WORKOUT' : 'ADD WORKOUT'}
                                </button>
                            </div>
                            <div className="mt-8 space-y-4">
                                <h3 className="text-xl font-bold text-cyan-400 mb-2">LOGGED WORKOUTS</h3>
                                {workouts.length === 0 ? (
                                    <p className="text-zinc-500 font-mono text-sm">NO DATA. INPUT REQUIRED.</p>
                                ) : (
                                    workouts.map((workout, index) => (
                                        <div key={index} className="flex justify-between items-center p-4 bg-zinc-800 bg-opacity-50 border-2 border-dashed border-zinc-700 rounded-xl transition-all duration-300 hover:border-teal-500 hover:shadow-lg hover:shadow-teal-500/20">
                                            <div className="flex-grow">
                                                <h4 className="font-bold text-white text-md tracking-wider">{workout.name}</h4>
                                                <p className="text-sm text-zinc-400 font-mono">DURATION: <span className="text-white">{workout.duration} MINS</span></p>
                                            </div>
                                            <div className="flex space-x-2">
                                                <button onClick={() => handleEditWorkout(index)} className="bg-zinc-700 text-blue-400 px-3 py-2 rounded-md text-xs font-mono transition duration-200 hover:bg-blue-900/50">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>EDIT
                                                </button>
                                                <button onClick={() => handleDeleteWorkout(index)} className="bg-zinc-700 text-red-400 px-3 py-2 rounded-md text-xs font-mono transition duration-200 hover:bg-red-900/50">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>DEL
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="relative z-10 text-zinc-500 p-6 text-center mt-8 font-mono border-t border-zinc-800">
                <p>&copy; 2025 BIO-INTERFACE | FITFUEL V6.3</p>
            </footer>

            {/* Custom Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-zinc-950 bg-opacity-80 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 bg-opacity-90 p-8 rounded-2xl shadow-xl max-w-sm w-full border-2 border-cyan-500/50">
                        <p className="text-lg font-mono text-white mb-6 tracking-wide">{modalMessage}</p>
                        <div className="flex justify-end space-x-3">
                            {modalType === 'alert' && (
                                <button onClick={closeModal} className="bg-cyan-600 text-white px-5 py-2 rounded-md font-mono transition duration-200 hover:bg-cyan-500">OK</button>
                            )}
                            {modalType === 'confirm' && (
                                <>
                                    <button onClick={closeModal} className="bg-zinc-700 text-white px-5 py-2 rounded-md font-mono transition duration-200 hover:bg-zinc-600">CANCEL</button>
                                    <button onClick={handleModalConfirm} className="bg-red-600 text-white px-5 py-2 rounded-md font-mono transition duration-200 hover:bg-red-500">CONFIRM</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Authentication Modal */}
            {showAuthModal && (
                <div className="fixed inset-0 bg-zinc-950 bg-opacity-80 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 bg-opacity-90 p-8 rounded-2xl shadow-xl max-w-md w-full border-2 border-purple-500/50">
                        <h2 className="text-3xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-6 font-mono">{isLoginMode ? 'LOGIN' : 'SIGN UP'}</h2>
                        <div className="flex justify-center mb-6 border border-zinc-700 rounded-md p-1">
                            <button
                                onClick={() => setIsLoginMode(true)}
                                className={`px-6 py-2 rounded-md font-bold ${isLoginMode ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'text-zinc-400 hover:bg-zinc-800'} transition-all duration-300 font-mono w-1/2`}
                            >
                                LOGIN
                            </button>
                            <button
                                onClick={() => setIsLoginMode(false)}
                                className={`px-6 py-2 rounded-md font-bold ${!isLoginMode ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'text-zinc-400 hover:bg-zinc-800'} transition-all duration-300 font-mono w-1/2`}
                            >
                                SIGN UP
                            </button>
                        </div>
                        <input type="email" placeholder="USER@TERMINAL.IO" className={`${inputStyle} mb-4`} value={email} onChange={(e) => setEmail(e.target.value)} />
                        <input type="password" placeholder="PASSWORD" className={`${inputStyle} mb-6`} value={password} onChange={(e) => setPassword(e.target.value)} />
                        {isLoginMode ? (
                            <button onClick={handleEmailLogin} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-4 rounded-md font-mono hover:shadow-lg hover:shadow-pink-500/50 transition duration-300 mb-4" disabled={authLoading}>
                                {authLoading ? 'ACCESSING...' : 'LOGIN'}
                            </button>
                        ) : (
                            <button onClick={handleEmailSignup} className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white py-3 px-4 rounded-md font-mono hover:shadow-lg hover:shadow-cyan-500/50 transition duration-300 mb-4" disabled={authLoading}>
                                {authLoading ? 'CREATING...' : 'SIGN UP'}
                            </button>
                        )}
                        <div className="relative flex items-center justify-center my-6">
                            <div className="flex-grow border-t border-zinc-700"></div>
                            <span className="flex-shrink mx-4 text-zinc-500 font-mono">OR</span>
                            <div className="flex-grow border-t border-zinc-700"></div>
                        </div>
                        <button onClick={handleGoogleLogin} className="w-full bg-zinc-800 text-white py-3 px-4 rounded-md font-mono hover:bg-zinc-700 transition duration-300 shadow-md flex items-center justify-center space-x-2" disabled={authLoading}>
                            <svg className="w-6 h-6" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M44.5 24.0086C44.5 22.0622 44.3218 20.1706 43.9806 18.3429H24.4996V29.4925H35.7952C35.2536 32.3276 33.6288 34.7671 31.2007 36.4385V43.167H40.0039C45.1637 38.4526 48 31.6022 48 24.0086C48 19.2604 46.9944 14.8093 45.1979 10.8719L38.4879 5.86206L30.9575 11.536C33.1537 16.5173 34.25 22.0086 34.25 27.5086C34.25 33.0086 33.1537 38.5086 30.9575 43.4899L38.4879 49.1639L45.1979 44.154C46.9944 40.2166 48 35.7655 48 31.0173C48 28.3618 47.4944 25.6173 46.5 23.0086H44.5Z" fill="#FFC107"/>
                                <path d="M24.4996 48C31.1396 48 36.8396 45.7486 40.0039 43.167L31.2007 36.4385C29.1415 37.8188 26.8282 38.8354 24.4996 38.8354C19.9575 38.8354 16.0396 36.1914 14.1288 32.3276L5.32561 39.0561C9.07172 44.2709 16.2082 48 24.4996 48Z" fill="#34A853"/>
                                <path d="M14.1288 32.3276C13.2982 30.1314 12.8354 27.8182 12.8354 25.4996C12.8354 23.181 13.2982 20.8678 14.1288 18.6716L5.32561 11.9431C1.5795 17.1579 0 23.0086 0 29.0086C0 35.0086 1.5795 40.8593 5.32561 46.0741L14.1288 39.3456C16.0396 35.4818 19.9575 32.8378 24.4996 32.8378L14.1288 32.3276Z" fill="#4285F4"/>
                                <path d="M24.4996 9.1646C26.8282 9.1646 29.1415 10.1812 30.9575 11.536L38.4879 5.86206C36.8396 3.28043 34.1396 1.1646 30.9575 0C26.8282 0 23.0086 2.64406 20.4996 6.5086L24.4996 9.1646Z" fill="#EA4335"/>
                            </svg>
                            <span>SIGN IN WITH GOOGLE</span>
                        </button>
                        <button onClick={() => setShowAuthModal(false)} className="w-full mt-4 bg-zinc-800 text-zinc-400 py-3 px-4 rounded-md font-mono hover:bg-zinc-700 transition duration-300">
                            CLOSE WINDOW
                        </button>
                    </div>
                </div>
            )}
            <style jsx>{`
                @keyframes pulse-slow {
                    0% { box-shadow: 0 0 100px 50px rgba(59, 130, 246, 0.1) inset; }
                    50% { box-shadow: 0 0 120px 60px rgba(124, 58, 237, 0.15) inset; }
                    100% { box-shadow: 0 0 100px 50px rgba(59, 130, 246, 0.1) inset; }
                }
            `}</style>
        </div>
    );
};

export default App;