import { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function PersonalInfoScreen() {
  const [info, setInfo] = useState({
    name: '',
    age: '',
    gender: '',
    bloodGroup: '',
    address: '',
    medicalNote: '',
  });

  const [hasData, setHasData] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const userId = 'user_001'; // Replace with dynamic user ID in future

  const fetchData = async () => {
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setInfo(docSnap.data() as typeof info);
        setHasData(true); // ✅ Mark data as available
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    }
  };

  const handleSave = async () => {
    try {
      const docRef = doc(db, 'users', userId);
      await setDoc(docRef, info);
      Alert.alert('✅ Saved', 'Your personal information was saved.');
      setHasData(true);
      setEditMode(false);
    } catch (error) {
      console.error('Save failed:', error);
      Alert.alert('❌ Error', 'Failed to save information.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>👤 Personal Information</Text>

      {hasData && !editMode ? (
        <>
          <Text style={styles.viewField}>👤 Name: {info.name}</Text>
          <Text style={styles.viewField}>🎂 Age: {info.age}</Text>
          <Text style={styles.viewField}>🚻 Gender: {info.gender}</Text>
          <Text style={styles.viewField}>🩸 Blood Group: {info.bloodGroup}</Text>
          <Text style={styles.viewField}>🏠 Address: {info.address}</Text>
          <Text style={styles.viewField}>📝 Medical Note: {info.medicalNote}</Text>
          <Button title="Edit Info" onPress={() => setEditMode(true)} />
        </>
      ) : (
        <>
          <TextInput placeholder="Full Name" value={info.name} onChangeText={val => setInfo({ ...info, name: val })} style={styles.input} />
          <TextInput placeholder="Age" keyboardType="number-pad" value={info.age} onChangeText={val => setInfo({ ...info, age: val })} style={styles.input} />
          <TextInput placeholder="Gender" value={info.gender} onChangeText={val => setInfo({ ...info, gender: val })} style={styles.input} />
          <TextInput placeholder="Blood Group" value={info.bloodGroup} onChangeText={val => setInfo({ ...info, bloodGroup: val })} style={styles.input} />
          <TextInput placeholder="Address" value={info.address} onChangeText={val => setInfo({ ...info, address: val })} style={styles.input} multiline />
          <TextInput placeholder="Medical Notes (e.g. allergies)" value={info.medicalNote} onChangeText={val => setInfo({ ...info, medicalNote: val })} style={styles.input} multiline />
          <Button title="Save Info" onPress={handleSave} />
          {hasData && <Button title="Cancel" color="gray" onPress={() => setEditMode(false)} />}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#000',
    flexGrow: 1
  },
  title: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 20,
    fontWeight: 'bold'
  },
  input: {
    backgroundColor: '#fff',
    padding: 10,
    marginBottom: 15,
    borderRadius: 8
  },
  viewField: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 12
  }
});
