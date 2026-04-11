// app/(auth)/sign-in.tsx
import { useSignIn, useSSO } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import React, { useCallback, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { AntDesign, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

// Preloads the browser for Android
export const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

WebBrowser.maybeCompleteAuthSession();

export default function SignInPage() {
  useWarmUpBrowser();
  
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  // --- LOGIQUE DE CONNEXION CLASSIQUE ---
  const onSignInPress = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      });

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace('/(tabs)/Home');
      } else {
        Alert.alert('Action requise', 'Veuillez compléter les étapes suivantes');
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.errors?.[0]?.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIQUE GOOGLE ---
  const onGoogleSignIn = useCallback(async () => {
    setLoading(true);
    try {
      const { createdSessionId, setActive: ssoSetActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });

      if (createdSessionId) {
        await ssoSetActive!({
          session: createdSessionId,
          navigate: async () => {
            router.replace('/(tabs)/Home');
          },
        });
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erreur', 'Connexion Google échouée');
    } finally {
      setLoading(false);
    }
  }, [startSSOFlow]);

  // --- LOGIQUE FACEBOOK ---
  const onFacebookSignIn = useCallback(async () => {
    setLoading(true);
    try {
      const { createdSessionId, setActive: ssoSetActive } = await startSSOFlow({
        strategy: 'oauth_facebook',
        redirectUrl: AuthSession.makeRedirectUri(),
      });

      if (createdSessionId) {
        await ssoSetActive!({
          session: createdSessionId,
          navigate: async () => {
            router.replace('/(tabs)/Home');
          },
        });
      }
    } catch (err: any) {
      Alert.alert('Erreur', 'Connexion Facebook échouée');
    } finally {
      setLoading(false);
    }
  }, [startSSOFlow]);

  return (
    <LinearGradient colors={['#08041a', '#120a2e', '#1e1b4b']} style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="eye-check" size={40} color="#c084fc" />
            </View>
            <Text style={styles.title}>EyeMate</Text>
            <Text style={styles.subtitle}>Welcome back to clarity</Text>
          </View>

          <View style={styles.formWrapper}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <BlurView intensity={20} tint="light" style={styles.glassInput}>
                <AntDesign name="user" size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput
                  autoCapitalize="none"
                  value={emailAddress}
                  placeholder="Email Address"
                  placeholderTextColor="#64748b"
                  onChangeText={setEmailAddress}
                  style={styles.input}
                  keyboardType="email-address"
                  editable={!loading}
                />
              </BlurView>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <BlurView intensity={20} tint="light" style={styles.glassInput}>
                <AntDesign name="lock" size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput
                  value={password}
                  placeholder="Password"
                  placeholderTextColor="#64748b"
                  secureTextEntry={true}
                  onChangeText={setPassword}
                  style={styles.input}
                  editable={!loading}
                />
              </BlurView>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              onPress={onSignInPress}
              style={styles.mainButton}
              disabled={loading}
            >
              <LinearGradient 
                colors={['#7c3aed', '#6d28d9']} 
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.line} />
            </View>

            {/* Social Buttons */}
            <View style={styles.socialRow}>
              <TouchableOpacity 
                style={styles.socialSquare} 
                onPress={onGoogleSignIn}
                disabled={loading}
              >
                <AntDesign name="google" size={24} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.socialSquare} 
                onPress={onFacebookSignIn}
                disabled={loading}
              >
                <FontAwesome name="facebook" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>New here? </Text>
              <Link href="/(auth)/sign-up" asChild>
                <TouchableOpacity disabled={loading}>
                  <Text style={styles.linkText}>Create Account</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 25, paddingVertical: 60 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 25,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  title: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  subtitle: { fontSize: 16, color: '#94a3b8', marginTop: 5 },
  formWrapper: { width: '100%' },
  inputContainer: { marginBottom: 15, borderRadius: 16, overflow: 'hidden' },
  glassInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: '#fff', fontSize: 16 },
  mainButton: { height: 60, borderRadius: 16, marginTop: 10, overflow: 'hidden' },
  gradientButton: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 30 },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  dividerText: { marginHorizontal: 15, color: '#64748b', fontSize: 12, fontWeight: '700' },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  socialSquare: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 40 },
  footerText: { color: '#94a3b8', fontSize: 15 },
  linkText: { color: '#c084fc', fontSize: 15, fontWeight: '700' },
});