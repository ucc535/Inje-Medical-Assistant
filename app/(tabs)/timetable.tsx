import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, BackHandler, Dimensions,
  FlatList,
  Image // 💡 Image 추가
  ,
  Modal, SafeAreaView, StyleSheet, Text,
  TextInput, TouchableOpacity, View
} from 'react-native';
import ImageViewer from 'react-native-image-zoom-viewer';

const { width, height } = Dimensions.get('window');

const RATIOS = [
  { label: '4:5', value: 4/5 },
  { label: '3:4', value: 3/4 },
  { label: '2:3', value: 2/3 },
  { label: '9:16', value: 9/16 },
];

const STORAGE_KEYS = {
  SELF: 'timetable_uri_self',
  PEERS: 'timetable_peers_map'
};

export default function TimetableScreen() {
  const isFocused = useIsFocused();
  const [myImageUri, setMyImageUri] = useState<string | null>(null);
  const [displayTitle, setDisplayTitle] = useState('내 시간표');
  const [displayImageUri, setDisplayImageUri] = useState<string | null>(null);
  const [peerTimetables, setPeerTimetables] = useState<{[key: string]: string}>({});

  const [tempImageUri, setTempImageUri] = useState<string | null>(null);
  const [selectedRatio, setSelectedRatio] = useState(RATIOS[2].value);
  const [editingTarget, setEditingTarget] = useState<{type: 'self' | 'peer', peerName?: string} | null>(null);

  const [showPeerMenu, setShowPeerMenu] = useState(false);
  const [showAddPeerModal, setShowAddPeerModal] = useState(false);
  const [newPeerName, setNewPeerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isFocused) {
      loadAllTimetables();
    }
  }, [isFocused]);

  const loadAllTimetables = async () => {
    try {
      const savedSelf = await AsyncStorage.getItem(STORAGE_KEYS.SELF);
      const savedPeers = await AsyncStorage.getItem(STORAGE_KEYS.PEERS);
      if (savedPeers) setPeerTimetables(JSON.parse(savedPeers));

      setMyImageUri(savedSelf);
      setDisplayImageUri(savedSelf);
      setDisplayTitle('내 시간표');
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const onBackPress = () => {
      if (displayTitle !== '내 시간표') {
        setDisplayTitle('내 시간표');
        setDisplayImageUri(myImageUri);
        return true;
      }
      return false;
    };
    if (isFocused) {
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }
  }, [isFocused, displayTitle, myImageUri]);

  const pickImage = async (type: 'self' | 'peer', peerName?: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('권한 필요', '앨범 접근 권한이 필요합니다.');
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled) {
      setTempImageUri(result.assets[0].uri);
      setEditingTarget({ type, peerName });
      setShowAddPeerModal(false);
    }
  };

  const handleCropAndSave = async () => {
    if (!tempImageUri || !editingTarget) return;
    setIsLoading(true);
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        tempImageUri, [{ resize: { width: 1200 } }], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      const finalUri = manipResult.uri;
      if (editingTarget.type === 'self') {
        setMyImageUri(finalUri); setDisplayImageUri(finalUri); setDisplayTitle('내 시간표');
        await AsyncStorage.setItem(STORAGE_KEYS.SELF, finalUri);
      } else if (editingTarget.type === 'peer' && editingTarget.peerName) {
        const name = editingTarget.peerName;
        const updatedPeers = { ...peerTimetables, [name]: finalUri };
        setPeerTimetables(updatedPeers);
        await AsyncStorage.setItem(STORAGE_KEYS.PEERS, JSON.stringify(updatedPeers));
        setDisplayImageUri(finalUri); setDisplayTitle(`${name} 시간표`);
      }
      setTempImageUri(null); setEditingTarget(null); setNewPeerName('');
    } catch (e) { Alert.alert('오류', '저장 실패'); } finally { setIsLoading(false); }
  };

  const handleDeletePeer = (name: string) => {
    Alert.alert('삭제', `${name}님의 시간표를 삭제할까요?`, [
      { text: '취소' }, { text: '삭제', style: 'destructive', onPress: async () => {
          const updatedPeers = { ...peerTimetables };
          delete updatedPeers[name];
          setPeerTimetables(updatedPeers);
          await AsyncStorage.setItem(STORAGE_KEYS.PEERS, JSON.stringify(updatedPeers));
          if (displayTitle === `${name} 시간표`) { setDisplayTitle('내 시간표'); setDisplayImageUri(myImageUri); }
      }}
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{displayTitle}</Text>
        {displayTitle === '내 시간표' && (
          <TouchableOpacity onPress={() => pickImage('self')} style={styles.editButton}>
            <Ionicons name="camera" size={18} color="#003594" />
            <Text style={styles.editText}>{myImageUri ? '변경' : '등록'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {displayImageUri ? (
          /* 💡 [수정] ImageViewer 대신 일반 Image를 사용하여 사진을 고정합니다. 
             이렇게 해야 화면을 옆으로 밀 때 사진이 제스처를 뺏어가지 않습니다. */
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: displayImageUri }} 
              style={styles.timetableImage} 
              resizeMode="contain" // 사진 전체가 잘리지 않게 표시
            />
          </View>
        ) : (
          <View style={styles.placeholderWrapper}>
            <TouchableOpacity style={styles.placeholder} onPress={() => pickImage('self')}>
              <Ionicons name="image-outline" size={60} color="#D1D9E6" />
              <Text style={styles.placeholderText}>시간표 사진을 올려주세요.</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.fabButton} onPress={() => setShowPeerMenu(true)}>
        <Ionicons name="list" size={26} color="#fff" />
      </TouchableOpacity>

      {/* 💡 영역 확인 모달 (여기서는 조작이 필요하므로 ImageViewer 유지) */}
      <Modal visible={!!tempImageUri} transparent={false} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setTempImageUri(null)}><Text style={styles.btnCancel}>취소</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>영역 확인</Text>
            <TouchableOpacity onPress={handleCropAndSave} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#003594" /> : <Text style={styles.btnDone}>완료</Text>}
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

      {/* 동기 목록 모달 */}
      <Modal visible={showPeerMenu} transparent={true} animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPeerMenu(false)}>
          <View style={styles.peerMenuContent}>
            <View style={styles.peerMenuHeader}>
              <Text style={styles.peerMenuTitle}>동기 시간표 목록</Text>
              <TouchableOpacity onPress={() => { setShowPeerMenu(false); setShowAddPeerModal(true); }}>
                <Ionicons name="person-add-outline" size={22} color="#003594" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={Object.entries(peerTimetables).map(([name, uri]) => ({name, uri}))}
              keyExtractor={(item) => item.name}
              style={{ maxHeight: height * 0.4 }}
              renderItem={({ item }) => (
                <View style={styles.peerItemRow}>
                  <TouchableOpacity style={styles.peerItemClickArea} onPress={() => { setDisplayTitle(`${item.name} 시간표`); setDisplayImageUri(item.uri); setShowPeerMenu(false); }}>
                    <Ionicons name="people-outline" size={20} color="#888" />
                    <Text style={styles.peerItemText}>{item.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeletePeer(item.name)}><Ionicons name="trash-outline" size={16} color="#E74C3C" /></TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyPeerText}>등록된 동기가 없습니다. +를 눌러 추가하세요.</Text>}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showAddPeerModal} transparent={true} animationType="slide">
        <SafeAreaView style={styles.addPeerOverlay}>
          <View style={styles.addPeerContent}>
            <View style={styles.addPeerHeader}>
              <Text style={styles.addPeerTitle}>동기 이름 입력</Text>
              <TouchableOpacity onPress={() => setShowAddPeerModal(false)}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            </View>
            <TextInput style={styles.addPeerInput} placeholder="이름 입력 (예: 영환)" value={newPeerName} onChangeText={setNewPeerName} autoFocus={true} />
            <TouchableOpacity style={styles.addPeerConfirmBtn} onPress={() => {
              if(!newPeerName.trim()) return Alert.alert('알림', '이름을 입력하세요.');
              pickImage('peer', newPeerName.trim());
            }}><Text style={styles.addPeerConfirmBtnText}>사진 선택하러 가기</Text></TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 20, paddingTop: 55, paddingBottom: 15, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 20, fontWeight: 'bold' },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0F4F8', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  editText: { color: '#003594', fontWeight: 'bold' },
  content: { flex: 1, padding: 10 },
  
  // 💡 [추가] 시간표 이미지 스타일
  imageContainer: { flex: 1, backgroundColor: '#F8F9FA', borderRadius: 20, overflow: 'hidden' },
  timetableImage: { width: '100%', height: '100%' },

  placeholderWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { alignItems: 'center', padding: 40, borderWidth: 2, borderColor: '#D1D9E6', borderStyle: 'dashed', borderRadius: 30 },
  placeholderText: { color: '#999', marginTop: 15 },
  fabButton: { position: 'absolute', bottom: 100, right: 30, backgroundColor: '#003594', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  peerMenuContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 25, paddingBottom: 40 },
  peerMenuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  peerMenuTitle: { fontSize: 18, fontWeight: 'bold' },
  peerItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F2F5F8' },
  peerItemClickArea: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  peerItemText: { fontSize: 16, color: '#555' },
  emptyPeerText: { textAlign: 'center', color: '#AAA', paddingVertical: 30 },
  addPeerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  addPeerContent: { width: '85%', backgroundColor: '#fff', borderRadius: 24, padding: 25 },
  addPeerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  addPeerTitle: { fontSize: 17, fontWeight: 'bold' },
  addPeerInput: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 15, fontSize: 16, color: '#003594', marginBottom: 25, borderWidth: 1, borderColor: '#E1E8EE' },
  addPeerConfirmBtn: { backgroundColor: '#003594', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  addPeerConfirmBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalContainer: { flex: 1, backgroundColor: '#000' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 55, paddingBottom: 20, backgroundColor: '#000' },
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