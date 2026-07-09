// app/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth } from '../../firebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';

const AuthContext = createContext();

// Keys for AsyncStorage
const BIOMETRIC_ENABLED_KEY = '@biometric_enabled';
// Device-level flag readable BEFORE anyone is signed in (drives the
// "Sign in with biometrics" shortcut on the auth screen).
const BIOMETRIC_LOGIN_KEY = '@biometric_login_enabled';
// SecureStore key holding the last successful email/password pair,
// encrypted at rest by the OS keystore and only released to the app
// after the biometric prompt succeeds.
const CREDENTIALS_KEY = 'wildwatch.credentials';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState(null);

  useEffect(() => {
    console.log('Setting up auth state listener...');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user?.email || 'No user');
      if (user) {
        setUser(user);
        await AsyncStorage.setItem('user', JSON.stringify(user));
        // Check biometric settings for this user
        await loadBiometricSettings();
      } else {
        setUser(null);
        await AsyncStorage.removeItem('user');
        setBiometricEnabled(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Check if biometric is available on device
  const checkBiometricSupport = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supported = hasHardware && isEnrolled;
      
      setBiometricSupported(supported);
      
      if (supported) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('fingerprint');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('face');
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType('iris');
        }
      }
      
      return supported;
    } catch (error) {
      console.error('Biometric support check failed:', error);
      setBiometricSupported(false);
      return false;
    }
  };

  // Load biometric settings for current user
  const loadBiometricSettings = async () => {
    if (!user) return;
    try {
      const enabled = await AsyncStorage.getItem(`${BIOMETRIC_ENABLED_KEY}_${user.uid}`);
      setBiometricEnabled(enabled === 'true');
    } catch (error) {
      console.error('Failed to load biometric settings:', error);
    }
  };

  // Enable or disable biometric authentication
  const setBiometricAuth = async (enabled) => {
    if (!user) return { success: false, error: 'No user logged in' };
    
    if (enabled && !biometricSupported) {
      const supported = await checkBiometricSupport();
      if (!supported) {
        return { success: false, error: 'Biometric authentication not available on this device' };
      }
    }
    
    try {
      if (enabled) {
        // Verify biometric before enabling
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify your identity to enable biometric login',
          fallbackLabel: 'Use passcode',
        });
        
        if (!result.success) {
          return { success: false, error: 'Verification failed' };
        }
      }
      
      await AsyncStorage.setItem(`${BIOMETRIC_ENABLED_KEY}_${user.uid}`, enabled.toString());
      // Mirror to the device-level flag so the auth screen can offer the
      // biometric shortcut before anyone is signed in.
      await AsyncStorage.setItem(BIOMETRIC_LOGIN_KEY, enabled.toString());
      if (!enabled) {
        await SecureStore.deleteItemAsync(CREDENTIALS_KEY).catch(() => {});
      }
      setBiometricEnabled(enabled);
      return { success: true };
    } catch (error) {
      console.error('Failed to save biometric settings:', error);
      return { success: false, error: error.message };
    }
  };

  // Authenticate using biometrics
  const authenticateWithBiometrics = async (actionName = 'perform this action') => {
    if (!biometricEnabled) {
      console.log('Biometric not enabled, skipping authentication');
      return { success: true, skipped: true };
    }
    
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Authenticate to ${actionName}`,
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      
      if (result.success) {
        console.log('Biometric authentication successful');
        return { success: true, skipped: false };
      } else {
        console.log('Biometric authentication failed:', result.error);
        return { success: false, error: result.error, skipped: false };
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return { success: false, error: error.message, skipped: false };
    }
  };

  // Require biometric for sensitive actions
  const requireBiometric = async (actionName, callback) => {
    const authResult = await authenticateWithBiometrics(actionName);
    
    if (authResult.success) {
      callback(true);
    } else {
      Alert.alert(
        'Authentication Required',
        `You need to authenticate to ${actionName}.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => callback(false) },
          { text: 'Retry', onPress: () => requireBiometric(actionName, callback) }
        ]
      );
    }
  };

  // Persist the last working email/password pair in the OS keystore so the
  // biometric shortcut can re-authenticate without retyping credentials.
  const storeCredentials = async (email, password) => {
    try {
      await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify({ email, password }));
    } catch (error) {
      console.warn('Could not store credentials for biometric login:', error.message);
    }
  };

  const signUp = async (email, password, displayName) => {
    try {
      console.log('Creating user with email:', email);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName });
      console.log('User created successfully:', userCredential.user.uid);
      await storeCredentials(email, password);
      // Initialize biometric settings for new user
      await loadBiometricSettings();
      return { success: true };
    } catch (error) {
      console.error('Sign up error:', error.message);
      return { success: false, error: error.message };
    }
  };

  const signIn = async (email, password) => {
    try {
      console.log('Signing in with email:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Sign in successful:', userCredential.user.uid);
      await storeCredentials(email, password);
      await loadBiometricSettings();
      return { success: true };
    } catch (error) {
      console.error('Sign in error:', error.message);
      return { success: false, error: error.message };
    }
  };

  // True when the auth screen should offer the biometric shortcut: hardware
  // + enrolment present, the user opted in on this device, and a credential
  // pair from a previous session is available in the keystore.
  const canUseBiometricLogin = async () => {
    try {
      const supported = await checkBiometricSupport();
      if (!supported) return false;
      const optedIn = (await AsyncStorage.getItem(BIOMETRIC_LOGIN_KEY)) === 'true';
      if (!optedIn) return false;
      return (await SecureStore.getItemAsync(CREDENTIALS_KEY)) !== null;
    } catch {
      return false;
    }
  };

  // Biometric login: prompt → release stored credentials → Firebase sign-in.
  const signInWithBiometrics = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to Wildwatch',
        fallbackLabel: 'Use password',
        cancelLabel: 'Cancel',
      });
      if (!result.success) {
        return { success: false, cancelled: true, error: 'Biometric authentication failed' };
      }
      const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY);
      if (!raw) {
        return { success: false, error: 'No saved credentials on this device — sign in with your password once.' };
      }
      const { email, password } = JSON.parse(raw);
      return await signIn(email, password);
    } catch (error) {
      console.error('Biometric sign in error:', error.message);
      return { success: false, error: error.message };
    }
  };

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      console.error('Password reset error:', error.message);
      return { success: false, error: error.message };
    }
  };

  // Recent-login proof required by Firebase for sensitive operations.
  const reauthenticate = async (currentPassword) => {
    if (!auth.currentUser?.email) throw new Error('No user logged in');
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  const updateDisplayName = async (displayName) => {
    if (!auth.currentUser) return { success: false, error: 'No user logged in' };
    try {
      await updateProfile(auth.currentUser, { displayName });
      setUser({ ...auth.currentUser }); // updateProfile doesn't re-fire onAuthStateChanged
      return { success: true };
    } catch (error) {
      console.error('Display name update error:', error.message);
      return { success: false, error: error.message };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    if (!auth.currentUser) return { success: false, error: 'No user logged in' };
    try {
      await reauthenticate(currentPassword);
      await updatePassword(auth.currentUser, newPassword);
      // Keep the biometric shortcut working with the new password.
      await storeCredentials(auth.currentUser.email, newPassword);
      return { success: true };
    } catch (error) {
      console.error('Password change error:', error.message);
      return { success: false, error: error.message };
    }
  };

  const deleteAccount = async (currentPassword) => {
    if (!auth.currentUser) return { success: false, error: 'No user logged in' };
    try {
      await reauthenticate(currentPassword);
      await deleteUser(auth.currentUser);
      await SecureStore.deleteItemAsync(CREDENTIALS_KEY).catch(() => {});
      await AsyncStorage.removeItem(BIOMETRIC_LOGIN_KEY);
      return { success: true };
    } catch (error) {
      console.error('Account deletion error:', error.message);
      return { success: false, error: error.message };
    }
  };

  // Verify the current user's password (chat lock fallback when biometrics
  // are unavailable or disabled).
  const verifyPassword = async (currentPassword) => {
    try {
      await reauthenticate(currentPassword);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      console.log('Logging out...');
      await signOut(auth);
      console.log('Logout successful');
      setBiometricEnabled(false);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error.message);
      return { success: false, error: error.message };
    }
  };

  // Get biometric icon name for UI
  const getBiometricIcon = () => {
    if (biometricType === 'fingerprint') return 'finger-print';
    if (biometricType === 'face') return 'face';
    if (biometricType === 'iris') return 'eye';
    return 'lock-closed';
  };

  // Get biometric display name
  const getBiometricName = () => {
    if (biometricType === 'fingerprint') return 'Fingerprint';
    if (biometricType === 'face') return 'Face ID';
    if (biometricType === 'iris') return 'Iris Scan';
    return 'Biometric';
  };

  // Check biometric support on mount
  useEffect(() => {
    checkBiometricSupport();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user,
      loading,
      signUp,
      signIn,
      logout,
      canUseBiometricLogin,
      signInWithBiometrics,
      resetPassword,
      updateDisplayName,
      changePassword,
      deleteAccount,
      verifyPassword,
      checkBiometricSupport,
      biometricEnabled,
      biometricSupported,
      biometricType,
      setBiometricAuth,
      authenticateWithBiometrics,
      requireBiometric,
      getBiometricIcon,
      getBiometricName,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthProvider;