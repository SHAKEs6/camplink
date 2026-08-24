import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from './src/lib/supabase';
import type { Session } from '@supabase/supabase-js';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    setMessage('');
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    if (result.error) setMessage(result.error.message);
    else if (mode === 'signup' && !result.data.session) setMessage('Check your email to confirm your account.');
  };

  if (loading) return <View style={styles.center}><Text style={styles.muted}>Loading Camplink...</Text></View>;

  if (session) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Text style={styles.eyebrow}>CAMPLINK CONNECT</Text>
          <Text style={styles.title}>Your campus, connected.</Text>
          <Text style={styles.subtitle}>Marketplace, community, wallet, and messages in one place.</Text>
          <View style={styles.grid}>
            {['Marketplace', 'Community', 'Wallet', 'Messages'].map((label) => (
              <View key={label} style={styles.tile}><Text style={styles.tileText}>{label}</Text><Text style={styles.tileHint}>Coming next</Text></View>
            ))}
          </View>
          <Text style={styles.account}>{session.user.email}</Text>
          <Pressable style={styles.secondaryButton} onPress={() => supabase.auth.signOut()}><Text style={styles.secondaryText}>Sign out</Text></Pressable>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>CAMPLINK CONNECT</Text>
        <Text style={styles.title}>Welcome back.</Text>
        <Text style={styles.subtitle}>Sign in with the same account you use on the Camplink website.</Text>
        <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor="#718096" value={email} onChangeText={setEmail} style={styles.input} />
        <TextInput secureTextEntry placeholder="Password" placeholderTextColor="#718096" value={password} onChangeText={setPassword} style={styles.input} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Pressable style={styles.button} onPress={submit}><Text style={styles.buttonText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text></Pressable>
        <Pressable onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}><Text style={styles.switchText}>{mode === 'signin' ? 'New to Camplink? Create an account' : 'Already have an account? Sign in'}</Text></Pressable>
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f7f6' },
  content: { flex: 1, padding: 28, justifyContent: 'center' },
  eyebrow: { color: '#13795b', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 14 },
  title: { color: '#14342a', fontSize: 38, fontWeight: '800', lineHeight: 44, marginBottom: 12 },
  subtitle: { color: '#52645e', fontSize: 16, lineHeight: 24, marginBottom: 28 },
  muted: { color: '#52645e' },
  input: { backgroundColor: '#fff', borderColor: '#d6e2dc', borderRadius: 12, borderWidth: 1, color: '#14342a', fontSize: 16, marginBottom: 12, padding: 16 },
  button: { alignItems: 'center', backgroundColor: '#13795b', borderRadius: 12, padding: 17, marginTop: 4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchText: { color: '#13795b', fontSize: 14, fontWeight: '600', marginTop: 20, textAlign: 'center' },
  message: { color: '#b74343', fontSize: 14, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 24 },
  tile: { backgroundColor: '#fff', borderColor: '#d6e2dc', borderRadius: 14, borderWidth: 1, padding: 18, width: '47%' },
  tileText: { color: '#14342a', fontSize: 16, fontWeight: '700' },
  tileHint: { color: '#718078', fontSize: 12, marginTop: 6 },
  account: { color: '#52645e', fontSize: 13, marginBottom: 16 },
  secondaryButton: { alignItems: 'center', borderColor: '#b8cec3', borderRadius: 12, borderWidth: 1, padding: 15 },
  secondaryText: { color: '#13795b', fontSize: 15, fontWeight: '700' },
});
