import { Ionicons } from '@expo/vector-icons';
import * as NavigationBar from 'expo-navigation-bar';
import { Stack, useSegments } from 'expo-router';
import * as SQLite from 'expo-sqlite'; // 💡 SQLite 비서 소환
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated,
  BackHandler,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text, TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MEMO_SHEET_HEIGHT = SCREEN_HEIGHT * 0.85;

// 🗄️ 통합 데이터베이스 연결
const db = SQLite.openDatabaseSync('medical_assistant_v2.db');

const MEMO_CATEGORIES = [
  { id: 'outpatient', label: '외래예진', color: '#E74C3C', template: '[CC(onset포함)]: \n[SOAP 기록]: \n[추정진단/계획]: ' },
  { id: 'pomr', label: '입원환자', color: '#3498DB', template: '[Problem List]: \n[Initial Assessment]: \n[Dx/Tx/Ed Plan]: ' },
  { id: 'case_pbl', label: '사례/PBL', color: '#9B59B6', template: '[Summarize]: \n[Narrow/Analyze]: \n[Probe/Plan]: \n[Learning Issue]: ' },
  { id: 'procedure', label: '술기/수술', color: '#27AE60', template: '[적응증]: \n[관찰소견/해부학]: \n[술기절차/합병증]: ' },
  { id: 'reflection', label: '성찰/기타', color: '#F1C40F', template: '[학습계획]: \n[교수님 피드백]: \n[환자안전/성찰]: ' },
];

export default function RootLayout() {
  // @ts-ignore
  const segments = useSegments() as string[];
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'write'>('list');
  
  // 💡 더 이상 allMemos 전체를 들고 있을 필요가 없습니다. DB가 기억하니까요!
  const [displayMemos, setDisplayMemos] = useState<any[]>([]);
  const [selectedMemo, setSelectedMemo] = useState<any>(null);
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState(MEMO_CATEGORIES[0]);
  const [memoTitle, setMemoTitle] = useState('');
  const [memoContent, setMemoContent] = useState(MEMO_CATEGORIES[0].template);

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const showMemoHandle = segments && segments[0] === '(tabs)';

  const getMemoHeaderDate = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const dayList = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = dayList[now.getDay()];
    return `${month}.${date} (${dayOfWeek})`;
  };

  // 🏥 1. 메모 테이블 초기화 (만약 캘린더보다 이 화면이 먼저 열릴 경우를 대비)
  useEffect(() => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS memos (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        category TEXT,
        color TEXT,
        createdAt TEXT
      );
    `);
  }, []);

  useEffect(() => {
    const backAction = () => {
      if (isMemoOpen) {
        if (viewMode === 'write' && editingMemoId) { setViewMode('detail'); return true; }
        if (viewMode === 'write' || viewMode === 'detail') { setViewMode('list'); return true; }
        closeMemo(); return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [isMemoOpen, viewMode, editingMemoId]);

  // 새벽 5시 30분 기준 오늘 날짜 필터링 함수
  const filterTodayMemos = (memos: any[]) => {
    const now = new Date();
    const threshold = new Date(now);
    threshold.setHours(5, 30, 0, 0);
    if (now < threshold) threshold.setDate(threshold.getDate() - 1);
    return memos.filter(m => new Date(m.createdAt).getTime() >= threshold.getTime());
  };

  // 🏥 2. DB에서 메모 가져오기
  const loadMemos = () => {
    try {
      // DB에서 최근 작성된 순으로 모두 가져온 뒤, 오늘 쓴 것만 필터링합니다.
      const parsed = db.getAllSync<any>("SELECT * FROM memos ORDER BY createdAt DESC");
      setDisplayMemos(filterTodayMemos(parsed));
    } catch (e) { console.error(e); }
  };

  const openMemo = () => { loadMemos(); setViewMode('list'); setIsMemoOpen(true); Animated.spring(translateY, { toValue: SCREEN_HEIGHT - MEMO_SHEET_HEIGHT, useNativeDriver: true, bounciness: 4 }).start(); };
  const closeMemo = () => { setIsMemoOpen(false); setEditingMemoId(null); setSelectedMemo(null); Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }).start(); };

  // 🏥 3. 메모 삭제 로직 (DB 연동)
  const deleteMemo = (id: string) => {
    Alert.alert("메모 삭제", "삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => {
        db.runSync("DELETE FROM memos WHERE id = ?", id);
        loadMemos(); // 💡 DB 삭제 후 리스트 갱신
        setViewMode('list');
      }}
    ]);
  };

  const startEdit = () => {
    if (!selectedMemo) return;
    setEditingMemoId(selectedMemo.id);
    setMemoTitle(selectedMemo.title);
    setMemoContent(selectedMemo.content);
    const cat = MEMO_CATEGORIES.find(c => c.label === selectedMemo.category) || MEMO_CATEGORIES[0];
    setSelectedCat(cat);
    setViewMode('write');
  };

  // 🏥 4. 메모 저장 및 수정 로직 (DB 연동)
  const saveMemo = () => {
    if (!memoTitle.trim()) return Alert.alert('알림', '제목을 입력해주세요.');

    try {
      if (editingMemoId) {
        // 수정할 때
        db.runSync(
          "UPDATE memos SET title = ?, content = ?, category = ?, color = ? WHERE id = ?",
          memoTitle, memoContent, selectedCat.label, selectedCat.color, editingMemoId
        );
      } else {
        // 새로 작성할 때
        const newId = Date.now().toString();
        const createdAt = new Date().toISOString();
        db.runSync(
          "INSERT INTO memos (id, title, content, category, color, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
          newId, memoTitle, memoContent, selectedCat.label, selectedCat.color, createdAt
        );
      }
      
      loadMemos(); // 💡 저장 후 리스트 갱신
      setMemoTitle(''); setEditingMemoId(null); setViewMode('list');
    } catch (e) { Alert.alert('오류', '메모 저장에 실패했습니다.'); }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy < -20,
      onPanResponderMove: (_, gestureState) => {
        const nextY = SCREEN_HEIGHT + gestureState.dy;
        if (nextY > SCREEN_HEIGHT - MEMO_SHEET_HEIGHT) translateY.setValue(nextY);
      },
      onPanResponderRelease: (_, gestureState) => { if (gestureState.dy < -120) openMemo(); else closeMemo(); },
    })
  ).current;

  useEffect(() => {
    if (Platform.OS === 'android') {
      const setNavMode = async () => {
        try {
          await NavigationBar.setBehaviorAsync('sticky-immersive' as any);
          await NavigationBar.setVisibilityAsync('hidden');
        } catch (e) { console.log(e); }
      };
      setNavMode();
    }
  }, []);

  return (
    <View style={styles.rootContainer}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="setup" />
        <Stack.Screen name="(tabs)" />
      </Stack>

      {showMemoHandle && (
        <>
          <Animated.View {...panResponder.panHandlers} style={[styles.dragHandleContainer, { bottom: 70 }]}>
            <TouchableOpacity style={styles.handleContent} onPress={openMemo} activeOpacity={1}>
              <View style={styles.handleBar} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.memoSheet, { transform: [{ translateY }] }]}>
            {/* 상단 헤더 영역 (기존 코드 유지) */}
            <View style={styles.sheetHeader}>
              <View style={styles.headerLeft}>
                <TouchableOpacity onPress={() => viewMode === 'list' ? closeMemo() : setViewMode('list')}>
                  <Ionicons name={viewMode === 'list' ? "chevron-down" : "arrow-back"} size={26} color="#333" />
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>
                  {viewMode === 'list' ? '메모장' : viewMode === 'detail' ? '메모 확인' : '메모화면'}
                </Text>
                
                {viewMode === 'list' && (
                  <Text style={styles.sheetDateText}>{getMemoHeaderDate()}</Text>
                )}
              </View>
              {viewMode === 'detail' && selectedMemo ? (
                <View style={styles.headerActions}>
                  <TouchableOpacity onPress={startEdit} style={styles.headerActionBtn}>
                    <Ionicons name="pencil-outline" size={20} color="#003594" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteMemo(selectedMemo.id)} style={styles.headerActionBtn}>
                    <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              ) : <View style={{ width: 40 }} />}
            </View>

            {/* 리스트 뷰 영역 */}
            {viewMode === 'list' && (
              <View style={styles.flexOne}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {displayMemos.length > 0 ? (
                    displayMemos.map(item => (
                      <TouchableOpacity key={item.id} style={[styles.memoItem, { borderLeftColor: item.color }]} onPress={() => { setSelectedMemo(item); setViewMode('detail'); }}>
                        <Text style={[styles.memoItemCat, { color: item.color }]}>{item.category}</Text>
                        <Text style={styles.memoItemTitle} numberOfLines={1}>{item.title}</Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>오늘 작성된 메모가 없습니다.</Text>
                    </View>
                  )}
                </ScrollView>
                <TouchableOpacity style={styles.fab} onPress={() => { setEditingMemoId(null); setMemoTitle(''); setMemoContent(selectedCat.template); setViewMode('write'); }}>
                  <Ionicons name="add" size={32} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            {/* 상세 뷰 영역 */}
            {viewMode === 'detail' && selectedMemo && (
              <View style={styles.flexOne}>
                <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
                  <View style={[styles.detailCatBadge, { backgroundColor: selectedMemo.color }]}><Text style={styles.detailCatText}>{selectedMemo.category}</Text></View>
                  <Text style={styles.detailTitle}>{selectedMemo.title}</Text>
                  <View style={styles.divider} />
                  <Text style={styles.detailContent}>{selectedMemo.content}</Text>
                  <View style={{ height: 50 }} />
                </ScrollView>
              </View>
            )}

            {/* 작성/수정 영역 */}
            {viewMode === 'write' && (
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flexOne}>
                <View style={styles.catContainer}>
                  {MEMO_CATEGORIES.map(cat => (
                    <TouchableOpacity key={cat.id} style={[styles.catBadge, selectedCat.id === cat.id && { backgroundColor: cat.color }]} onPress={() => { setSelectedCat(cat); if(!editingMemoId) setMemoContent(cat.template); }}>
                      <Text style={[styles.catBadgeText, selectedCat.id === cat.id && { color: '#fff' }]}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={styles.titleInput} placeholder="제목 입력" value={memoTitle} onChangeText={setMemoTitle} />
                <TextInput style={styles.contentInput} multiline value={memoContent} onChangeText={setMemoContent} textAlignVertical="top" />
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: selectedCat.color }]} onPress={saveMemo}><Text style={styles.saveBtnText}>{editingMemoId ? '수정 완료' : '저장하기'}</Text></TouchableOpacity>
              </KeyboardAvoidingView>
            )}
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: '#fff' },
  flexOne: { flex: 1 },
  dragHandleContainer: { position: 'absolute', width: '100%', height: 35, backgroundColor: 'rgba(255,255,255,0.98)', borderTopLeftRadius: 20, borderTopRightRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EEE', elevation: 20 },
  handleContent: { width: '100%', alignItems: 'center', paddingVertical: 10 },
  handleBar: { width: 50, height: 5, backgroundColor: '#E0E0E0', borderRadius: 3 },
  memoSheet: { position: 'absolute', left: 0, right: 0, height: MEMO_SHEET_HEIGHT, backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, elevation: 30 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F2F5F8' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  sheetDateText: { fontSize: 14, color: '#A0A0A0', marginLeft: 5, fontWeight: '400', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerActionBtn: { padding: 8, backgroundColor: '#F8F9FA', borderRadius: 10 },
  memoItem: { backgroundColor: '#F8F9FA', padding: 18, borderRadius: 15, marginBottom: 12, borderLeftWidth: 6 },
  memoItemCat: { fontSize: 10, fontWeight: '800', marginBottom: 4 },
  memoItemTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  fab: { position: 'absolute', right: 0, bottom: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#003594', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  detailScroll: { flex: 1, marginTop: 10 },
  detailCatBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 12 },
  detailCatText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  detailTitle: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 15 },
  divider: { height: 1, backgroundColor: '#EEE', marginBottom: 15 },
  detailContent: { fontSize: 16, color: '#444', lineHeight: 26 },
  catContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 15 },
  catBadge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#F2F5F8' },
  catBadgeText: { fontSize: 12, color: '#888', fontWeight: 'bold' },
  titleInput: { fontSize: 18, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#EEE', paddingVertical: 10, marginBottom: 15 },
  contentInput: { flex: 1, fontSize: 16, color: '#444', lineHeight: 24 },
  saveBtn: { padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { textAlign: 'center', color: '#BBB', fontSize: 14 },
});