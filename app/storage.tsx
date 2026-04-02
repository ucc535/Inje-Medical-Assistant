import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert, FlatList,
  Modal,
  SafeAreaView, StyleSheet,
  Text,
  TextInput,
  TouchableOpacity, View
} from 'react-native';

const db = SQLite.openDatabaseSync('clinical_box_v2.db');

interface BoxItem {
  id: number;
  name: string;
  type: 'file' | 'folder';
  parentId: number | null;
  uri?: string;
  size?: number;
  isStarred: number; 
}

export default function StorageScreen() {
  const router = useRouter();
  
  const [displayItems, setDisplayItems] = useState<BoxItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const [modalMode, setModalMode] = useState<'folder' | 'rename' | null>(null);
  const [inputText, setInputText] = useState('');
  const [targetItemId, setTargetItemId] = useState<number | null>(null);

  useEffect(() => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        parentId INTEGER,
        uri TEXT,
        size INTEGER,
        isStarred INTEGER DEFAULT 0
      );
    `);
    refreshList();
  }, [currentFolderId]);

  const refreshList = () => {
    let query = currentFolderId === null 
      ? "SELECT * FROM items WHERE parentId IS NULL" 
      : "SELECT * FROM items WHERE parentId = ?";
    
    // 여기는 파라미터 배열이 맞습니다. (getAllSync 문법)
    const params = currentFolderId === null ? [] : [currentFolderId];
    const result = db.getAllSync<BoxItem>(query, ...params);
    
    const sorted = [...result].sort((a, b) => {
      if (a.isStarred !== b.isStarred) return b.isStarred - a.isStarred;
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    setDisplayItems(sorted);
  };

  // 📂 파일 추가 (Expo Go 버그 우회 및 자동 대응 로직 적용)
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUpdating(true);
        const file = result.assets[0];
        
        // 정식 저장소 경로를 불러옵니다.
        const docDir = (FileSystem as any).documentDirectory;
        let finalUri = file.uri; // 기본적으로는 DocumentPicker가 만들어준 임시 캐시 경로를 사용
        
        // 만약 정식 저장소가 정상적으로 존재한다면 (실제 빌드 앱 환경)
        if (docDir) {
          const safeSystemFileName = file.name.replace(/\s+/g, '_'); 
          const internalUri = `${docDir}${Date.now()}_${safeSystemFileName}`;
          await FileSystem.copyAsync({ from: file.uri, to: internalUri });
          finalUri = internalUri; // 영구 보관용 경로로 교체
        } else {
          // Expo Go 환경이라 정식 경로가 없다면, 경고 팝업 없이 캐시 경로를 그대로 DB에 저장하여 테스트 진행
          console.warn("Expo Go 임시 환경: 캐시 경로에 파일을 임시 저장합니다.");
        }

        db.runSync(
          "INSERT INTO items (name, type, parentId, uri, size, isStarred) VALUES (?, ?, ?, ?, ?, 0)",
          file.name, 'file', currentFolderId, finalUri, file.size || 0
        );
        
        refreshList();
      }
    } catch (e) { 
      Alert.alert('파일 추가 실패', String(e)); 
      console.error(e);
    } finally { 
      setIsUpdating(false); 
    }
  };

  const handleModalConfirm = () => {
    if (!inputText.trim()) return;
    if (modalMode === 'folder') {
      // 💡 [문제 해결] 대괄호 제거
      db.runSync("INSERT INTO items (name, type, parentId) VALUES (?, ?, ?)", inputText.trim(), 'folder', currentFolderId);
    } else if (modalMode === 'rename' && targetItemId) {
      // 💡 [문제 해결] 대괄호 제거
      db.runSync("UPDATE items SET name = ? WHERE id = ?", inputText.trim(), targetItemId);
    }
    setModalMode(null);
    refreshList();
  };

  const toggleStar = (item: BoxItem) => {
    const newStatus = item.isStarred === 1 ? 0 : 1;
    // 💡 [문제 해결] 대괄호 제거
    db.runSync("UPDATE items SET isStarred = ? WHERE id = ?", newStatus, item.id);
    refreshList();
  };

  const handleItemPress = (item: BoxItem) => {
    if (item.type === 'folder') setCurrentFolderId(item.id);
    else if (item.uri) Sharing.shareAsync(item.uri);
  };

  const showManageMenu = (item: BoxItem) => {
    Alert.alert(item.name, '작업을 선택하세요', [
      { text: '취소', style: 'cancel' },
      { 
        text: item.isStarred === 1 ? '⭐ 즐겨찾기 해제' : '⭐ 즐겨찾기 등록', 
        onPress: () => toggleStar(item) 
      },
      { text: '✏️ 이름 변경', onPress: () => { setTargetItemId(item.id); setInputText(item.name); setModalMode('rename'); }},
      { text: '🗑️ 삭제', style: 'destructive', onPress: () => deleteItem(item) },
    ]);
  };

  const deleteItem = (target: BoxItem) => {
    Alert.alert('삭제 확인', '정말 삭제할까요?', [
      { text: '취소' },
      { text: '삭제', style: 'destructive', onPress: async () => {
          // 💡 [문제 해결] 대괄호 제거
          db.runSync("DELETE FROM items WHERE id = ?", target.id);
          if (target.uri) await FileSystem.deleteAsync(target.uri, { idempotent: true });
          refreshList();
      }}
    ]);
  };

  const goUp = () => {
    if (currentFolderId === null) router.back();
    else {
      // 💡 [문제 해결] 대괄호 제거
      const currentFolder = db.getFirstSync<BoxItem>("SELECT parentId FROM items WHERE id = ?", currentFolderId);
      setCurrentFolderId(currentFolder ? currentFolder.parentId : null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goUp} style={styles.backBtn}>
          <Ionicons name={currentFolderId ? "arrow-up" : "arrow-back"} size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {currentFolderId ? db.getFirstSync<BoxItem>("SELECT name FROM items WHERE id = ?", currentFolderId)?.name : 'Clinical Box'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={displayItems}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.card, item.isStarred === 1 && styles.starredCard]} 
            onPress={() => handleItemPress(item)}
            onLongPress={() => showManageMenu(item)}
          >
            <View style={[styles.iconBox, { backgroundColor: item.type === 'folder' ? '#FFF9E6' : '#F0F4F8' }]}>
              <Ionicons 
                name={item.type === 'folder' ? 'folder' : getFileIcon(item.name)} 
                size={24} 
                color={item.type === 'folder' ? '#F1C40F' : '#003594'} 
              />
            </View>
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                {item.isStarred === 1 && <Ionicons name="star" size={14} color="#F1C40F" style={{marginLeft: 5}} />}
              </View>
              <Text style={styles.sub}>{item.type === 'folder' ? '폴더' : `${((item.size || 0) / 1024 / 1024).toFixed(2)} MB`}</Text>
            </View>
            <TouchableOpacity onPress={() => showManageMenu(item)} style={{padding: 5}}>
              <Ionicons name="ellipsis-vertical" size={18} color="#CCC" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={60} color="#EEE" />
            <Text style={styles.emptyText}>항목이 없습니다.</Text>
          </View>
        }
      />

      <Modal visible={!!modalMode} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modalMode === 'folder' ? '새 폴더 이름' : '이름 변경'}</Text>
            <TextInput style={styles.input} autoFocus value={inputText} onChangeText={setInputText} placeholder="이름 입력" />
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setModalMode(null)}><Text style={styles.cancelTxt}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleModalConfirm} style={{marginLeft: 25}}><Text style={styles.doneTxt}>확인</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {isUpdating && <View style={styles.loading}><ActivityIndicator size="large" color="#003594" /></View>}
      <TouchableOpacity style={styles.fab} onPress={() => Alert.alert('추가', '무엇을 추가할까요?', [
        { text: '취소' },
        { text: '📁 새 폴더', onPress: () => { setModalMode('folder'); setInputText(''); } },
        { text: '📄 파일 추가', onPress: pickFile },
      ])}><Ionicons name="add" size={32} color="#FFF" /></TouchableOpacity>
    </SafeAreaView>
  );
}

const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext!)) return 'image-outline';
  if (ext === 'pdf') return 'document-text-outline';
  if (['xlsx', 'xls', 'csv'].includes(ext!)) return 'stats-chart-outline';
  if (['doc', 'docx', 'txt'].includes(ext!)) return 'document-text';
  return 'file-tray-full-outline';
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 15, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', flex: 1, textAlign: 'center' },
  listContainer: { padding: 20, paddingBottom: 100 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 18, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5 },
  starredCard: { borderLeftWidth: 4, borderLeftColor: '#F1C40F' }, 
  iconBox: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, marginLeft: 15 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  sub: { fontSize: 12, color: '#999', marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 150 },
  emptyText: { fontSize: 16, color: '#CCC', marginTop: 15 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#003594', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#FFF', borderRadius: 20, padding: 25 },
  modalTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 15 },
  input: { backgroundColor: '#F2F5F8', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 20 },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end' },
  cancelTxt: { color: '#999', fontWeight: 'bold', fontSize: 16 },
  doneTxt: { color: '#003594', fontWeight: 'bold', fontSize: 16 },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 10 }
});