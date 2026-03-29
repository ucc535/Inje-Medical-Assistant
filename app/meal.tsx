import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert, Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import ImageViewer from 'react-native-image-zoom-viewer';
import PagerView from 'react-native-pager-view';

const { width, height } = Dimensions.get('window');
const WEEK_DAYS = ['월', '화', '수', '목', '금', '토', '일'];

const RATIOS = [
  { label: '4:5', value: 4/5 },
  { label: '3:4', value: 3/4 },
  { label: '2:3', value: 2/3 },
  { label: '9:16', value: 9/16 },
];

const STORAGE_KEYS = {
  TEXT: 'meal_text_data_v4',
  IMAGE: 'meal_image_uri_v4',
  PREF: 'meal_view_pref_v4'
};

export default function MealScreen() {
  const isFocused = useIsFocused();
  const pagerRef = useRef<PagerView>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'initial' | 'text' | 'image' | 'textEdit'>('initial');
  
  const [weeklyMeals, setWeeklyMeals] = useState<string[]>(Array(7).fill(''));
  const [mealImageUri, setMealImageUri] = useState<string | null>(null);
  const [hasText, setHasText] = useState(false);
  const [hasImage, setHasImage] = useState(false);

  const [tempImageUri, setTempImageUri] = useState<string | null>(null);
  const [selectedRatio, setSelectedRatio] = useState(RATIOS[1].value); 
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isFocused) loadAllData();
  }, [isFocused]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const savedText = await AsyncStorage.getItem(STORAGE_KEYS.TEXT);
      const savedImage = await AsyncStorage.getItem(STORAGE_KEYS.IMAGE);
      const savedPref = await AsyncStorage.getItem(STORAGE_KEYS.PREF);

      if (savedText) { setWeeklyMeals(JSON.parse(savedText)); setHasText(true); }
      if (savedImage) { setMealImageUri(savedImage); setHasImage(true); }

      if (!savedText && !savedImage) setViewMode('initial');
      else if (savedText && !savedImage) setViewMode('text');
      else if (!savedText && savedImage) setViewMode('image');
      else setViewMode(savedPref === 'image' ? 'image' : 'text');
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const saveTextData = async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.TEXT, JSON.stringify(weeklyMeals));
    setHasText(true); setViewMode('text');
    await AsyncStorage.setItem(STORAGE_KEYS.PREF, 'text');
    Alert.alert('알림', '식단이 저장되었습니다.');
  };

  const pickMealImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('권한 필요', '앨범 접근 권한이 필요합니다.');
    
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      setTempImageUri(result.assets[0].uri);
    }
  };

  const handleImageConfirm = async () => {
    if (!tempImageUri) return;
    setIsProcessing(true);
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        tempImageUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      const finalUri = manipResult.uri;
      await AsyncStorage.setItem(STORAGE_KEYS.IMAGE, finalUri);
      setMealImageUri(finalUri);
      setHasImage(true);
      setViewMode('image');
      await AsyncStorage.setItem(STORAGE_KEYS.PREF, 'image');
      setTempImageUri(null);
    } catch (e) {
      Alert.alert('오류', '저장 실패');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) return <View style={styles.center}><ActivityIndicator color="#003594" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      {/* 💡 헤더: 제목을 '식단'으로 통일 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>식단</Text>
        <View style={styles.headerIcons}>
          {hasText && hasImage && (viewMode === 'text' || viewMode === 'image') && (
            <TouchableOpacity onPress={() => setViewMode(viewMode === 'text' ? 'image' : 'text')}>
              <Ionicons name={viewMode === 'text' ? "image-outline" : "text-outline"} size={24} color="#003594" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setViewMode('initial')}>
            <Ionicons name="add-circle-outline" size={26} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'initial' && (
        <View style={styles.center}>
          <Text style={styles.infoText}>식단 등록 방식을 선택하세요.</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.choiceCard} onPress={() => setViewMode('textEdit')}>
              <Ionicons name="create-outline" size={32} color="#003594" />
              <Text style={styles.choiceText}>직접 입력</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.choiceCard} onPress={pickMealImage}>
              <Ionicons name="camera-outline" size={32} color="#003594" />
              <Text style={styles.choiceText}>사진 등록</Text>
            </TouchableOpacity>
          </View>
          {(hasText || hasImage) && (
            <TouchableOpacity style={styles.cancelBtn} onPress={loadAllData}>
              <Text style={{color: '#888'}}>취소</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {viewMode === 'text' && (
        <PagerView ref={pagerRef} style={{ flex: 1 }} initialPage={0}>
          {WEEK_DAYS.map((day, idx) => (
            <View key={day} style={styles.center}>
              <View style={styles.dayBadge}><Text style={styles.dayText}>{day}요일 점심</Text></View>
              <ScrollView contentContainerStyle={styles.mealTextContainer} showsVerticalScrollIndicator={false}>
                <Text style={styles.mealMenuText}>{weeklyMeals[idx] || "등록된 식단 없음"}</Text>
              </ScrollView>
              <TouchableOpacity style={styles.editFab} onPress={() => setViewMode('textEdit')}>
                <Ionicons name="pencil" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </PagerView>
      )}

      {viewMode === 'image' && mealImageUri && (
        <View style={{flex: 1}}>
          <ImageViewer imageUrls={[{ url: mealImageUri }]} renderIndicator={() => <></>} backgroundColor="#FFF" />
          <View style={styles.zoomHint}><Text style={{color:'#AAA', fontSize:12}}>두 손가락으로 확대/축소가 가능합니다.</Text></View>
        </View>
      )}

      {viewMode === 'textEdit' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView style={{ padding: 25 }}>
            <Text style={styles.editTitle}>주간 식단 입력</Text>
            {WEEK_DAYS.map((day, idx) => (
              <View key={`edit-${day}`} style={{ marginBottom: 20 }}>
                <Text style={styles.inputLabel}>{day}요일 점심</Text>
                <TextInput 
                  style={styles.textInput} multiline value={weeklyMeals[idx]} placeholder="메뉴를 입력하세요"
                  onChangeText={(val) => { const n = [...weeklyMeals]; n[idx] = val; setWeeklyMeals(n); }}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.saveBtn} onPress={saveTextData}>
              <Text style={styles.saveBtnText}>저장하기</Text>
            </TouchableOpacity>
            <View style={{ height: 60 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <Modal visible={!!tempImageUri} transparent={false} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setTempImageUri(null)}><Text style={styles.btnCancel}>취소</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>식단표 확인</Text>
            <TouchableOpacity onPress={handleImageConfirm} disabled={isProcessing}>
              {isProcessing ? <ActivityIndicator color="#003594" /> : <Text style={styles.btnDone}>완료</Text>}
            </TouchableOpacity>
          </View>
          <View style={styles.cropArea}>
            <ImageViewer imageUrls={[{ url: tempImageUri || '' }]} backgroundColor="#000" renderIndicator={() => <></>} style={{ width: width, height: height * 0.65 }} />
            <View style={[styles.cropGuide, { width: width * 0.85, aspectRatio: selectedRatio }]} pointerEvents="none" />
          </View>
          <View style={styles.bottomControl}>
            <View style={styles.ratioSelector}>
              {RATIOS.map((r) => (
                <TouchableOpacity key={r.label} onPress={() => setSelectedRatio(r.value)} style={[styles.ratioBtn, selectedRatio === r.value && styles.ratioBtnActive]}>
                  <Text style={[styles.ratioBtnText, selectedRatio === r.value && styles.ratioBtnTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A' },
  headerIcons: { flexDirection: 'row', gap: 15, alignItems: 'center' },
  infoText: { fontSize: 16, color: '#666', marginBottom: 35 },
  row: { flexDirection: 'row', gap: 20 },
  choiceCard: { width: 140, height: 140, backgroundColor: '#F8F9FA', borderRadius: 25, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  choiceText: { marginTop: 15, fontWeight: 'bold', color: '#003594' },
  cancelBtn: { marginTop: 30, padding: 10 },
  dayBadge: { backgroundColor: '#F0F4F8', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, marginBottom: 20 },
  dayText: { color: '#003594', fontWeight: 'bold' },
  mealTextContainer: { flexGrow: 1, justifyContent: 'center', paddingBottom: 100 },
  mealMenuText: { fontSize: 22, textAlign: 'center', lineHeight: 38, fontWeight: '600', color: '#333' },
  editFab: { position: 'absolute', right: 25, bottom: 25, backgroundColor: '#003594', width: 55, height: 55, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  zoomHint: { position: 'absolute', bottom: 30, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 15, paddingVertical: 7, borderRadius: 20 },
  editTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 25 },
  inputLabel: { fontWeight: 'bold', marginBottom: 8, color: '#555' },
  textInput: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 18, fontSize: 16, height: 90, textAlignVertical: 'top', borderWidth: 1, borderColor: '#EEE' },
  saveBtn: { backgroundColor: '#003594', padding: 20, borderRadius: 15, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  modalContainer: { flex: 1, backgroundColor: '#000' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 20, paddingBottom: 20, backgroundColor: '#000' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  btnCancel: { color: '#AAA', fontSize: 16 },
  btnDone: { color: '#003594', fontSize: 16, fontWeight: 'bold' },
  cropArea: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  cropGuide: { position: 'absolute', borderWidth: 2, borderColor: '#003594', borderRadius: 8, backgroundColor: 'rgba(0, 53, 148, 0.1)' },
  bottomControl: { paddingBottom: 40, backgroundColor: '#111', alignItems: 'center', padding: 20 },
  ratioSelector: { flexDirection: 'row', gap: 10 },
  ratioBtn: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 10, backgroundColor: '#222' },
  ratioBtnActive: { backgroundColor: '#003594' },
  ratioBtnText: { color: '#888', fontSize: 13 },
  ratioBtnTextActive: { color: '#fff', fontWeight: 'bold' },
});