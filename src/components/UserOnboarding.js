import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.config';
import { getSettingsDoc } from '../utils/appArtifacts';

const UserOnboarding = ({ user, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [showSkip, setShowSkip] = useState(true);
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();
  const overlayRef = useRef(null);

  const steps = [
    {
      id: 'welcome',
      title: 'Welcome to ACCTOO!',
      description: 'Your complete business management solution. Let\'s get you started with a quick tour.',
      icon: '🎉',
      position: 'center',
      action: 'next'
    },
    {
      id: 'dashboard',
      title: 'Dashboard Overview',
      description: 'Your business at a glance. View sales, purchases, payments, and key metrics all in one place.',
      icon: '📊',
      position: 'center',
      action: 'navigate',
      route: '/dashboard'
    },
    {
      id: 'quick-actions',
      title: 'Quick Actions',
      description: 'Access your most used features instantly. Add sales, purchases, or manage parties with just one tap.',
      icon: '⚡',
      position: 'bottom',
      action: 'highlight',
      selector: '.quick-actions-section'
    },
    {
      id: 'mobile-nav',
      title: 'Mobile Navigation',
      description: 'On mobile? Use the bottom navigation bar for quick access to all modules.',
      icon: '📱',
      position: 'bottom',
      action: 'highlight',
      selector: '.mobile-bottom-nav'
    },
    {
      id: 'offline-mode',
      title: 'Work Offline',
      description: 'Continue working even without internet. Your data syncs automatically when you\'re back online.',
      icon: '🌐',
      position: 'top',
      action: 'highlight',
      selector: '.offline-indicator'
    },
    {
      id: 'sales',
      title: 'Sales Management',
      description: 'Create invoices, track sales, and manage customer relationships efficiently.',
      icon: '💰',
      position: 'center',
      action: 'navigate',
      route: '/sales'
    },
    {
      id: 'purchases',
      title: 'Purchase Management',
      description: 'Track expenses, manage suppliers, and maintain inventory with ease.',
      icon: '📦',
      position: 'center',
      action: 'navigate',
      route: '/purchases'
    },
    {
      id: 'reports',
      title: 'Reports & Analytics',
      description: 'Generate detailed reports and analyze your business performance with interactive charts.',
      icon: '📈',
      position: 'center',
      action: 'navigate',
      route: '/reports'
    },
    {
      id: 'complete',
      title: 'You\'re All Set!',
      description: 'Start managing your business efficiently. You can always access help from the menu.',
      icon: '✅',
      position: 'center',
      action: 'complete'
    }
  ];

  useEffect(() => {
    // Check if user has completed onboarding
    const checkOnboardingStatus = async () => {
      setIsChecking(true);
      
      if (!user || !user.uid) {
        // No user, don't show onboarding
        setIsVisible(false);
        setIsChecking(false);
        return;
      }

      try {
        const userDoc = getSettingsDoc(user.uid);
        const userData = await getDoc(userDoc);
        
        if (userData.exists() && userData.data().onboardingCompleted) {
          // User has already completed onboarding
          console.log('User has completed onboarding, hiding tour');
          setIsVisible(false);
          if (onComplete) onComplete();
        } else {
          // User hasn't completed onboarding, show it
          console.log('User has not completed onboarding, showing tour');
          setIsVisible(true);
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // On error, don't show onboarding to avoid repeated prompts
        setIsVisible(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkOnboardingStatus();
  }, [user, onComplete]);

  useEffect(() => {
    if (isVisible && currentStep < steps.length) {
      const currentStepData = steps[currentStep];
      
      // Handle different action types
      switch (currentStepData.action) {
        case 'navigate':
          if (currentStepData.route) {
            navigate(currentStepData.route);
          }
          break;
        case 'highlight':
          if (currentStepData.selector) {
            highlightElement(currentStepData.selector);
          }
          break;
        default:
          break;
      }
    }
  }, [currentStep, isVisible, navigate]);

  const highlightElement = (selector) => {
    // Remove previous highlights
    document.querySelectorAll('.onboarding-highlight').forEach(el => {
      el.classList.remove('onboarding-highlight');
    });

    // Add highlight to current element
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add('onboarding-highlight');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipOnboarding = () => {
    completeOnboarding();
  };

  const completeOnboarding = async () => {
    try {
      if (user && user.uid) {
        const userDoc = getSettingsDoc(user.uid);
        await updateDoc(userDoc, {
          onboardingCompleted: true,
          onboardingCompletedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error updating onboarding status:', error);
    }

    setIsVisible(false);
    if (onComplete) onComplete();
  };

  const currentStepData = steps[currentStep];

  // Don't render anything while checking or if not visible
  if (isChecking) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700">Loading...</span>
          </div>
        </div>
      </div>
    );
  }
  
  if (!isVisible) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        ref={overlayRef}
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === overlayRef.current) {
            // Allow clicking outside to close on certain steps
            if (currentStep === 0 || currentStep === steps.length - 1) {
              completeOnboarding();
            }
          }
        }}
      >
        {/* Onboarding Card */}
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 ease-in-out">
          {/* Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-3xl">{currentStepData.icon}</span>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {currentStepData.title}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Step {currentStep + 1} of {steps.length}
                  </p>
                </div>
              </div>
              {showSkip && currentStep < steps.length - 1 && (
                <button
                  onClick={skipOnboarding}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Skip
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-gray-700 leading-relaxed mb-6">
              {currentStepData.description}
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              ></div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <button
                onClick={prevStep}
                disabled={currentStep === 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentStep === 0
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                Previous
              </button>

              <button
                onClick={nextStep}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Tips */}
      <div className="fixed bottom-4 right-4 z-40">
        <div className="bg-white rounded-lg shadow-lg p-4 max-w-xs">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <span className="text-2xl">💡</span>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 text-sm mb-1">
                Quick Tip
              </h4>
              <p className="text-xs text-gray-600">
                {getQuickTip(currentStep)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const getQuickTip = (step) => {
  const tips = [
    "Use the search bar to quickly find any transaction or party.",
    "Swipe left on mobile tables to see more actions.",
    "Long press on charts to zoom in for detailed view.",
    "Pull down to refresh data on any page.",
    "Use the offline indicator to check your connection status.",
    "Export reports as PDF for sharing with stakeholders.",
    "Set up recurring transactions to save time.",
    "Use the dashboard filters to view data for specific periods.",
    "Access help anytime from the menu or settings."
  ];
  
  return tips[step] || tips[0];
};

export default UserOnboarding; 