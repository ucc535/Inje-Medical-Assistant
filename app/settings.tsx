import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker'; // 💡 파일 선택 기능 추가
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Linking, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const db = SQLite.openDatabaseSync('medical_assistant_v2.db');

export default function SettingsScreen() {
  const [name, setName] = useState('');
  const router = useRouter();

  // 🔍 검색 관련 상태 (영환님의 기존 기능 유지)
  const [isSearchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    loadName();
  }, []);

  const loadName = async () => {
    try {
      const savedName = await AsyncStorage.getItem('user_name');
      if (savedName) setName(savedName);
    } catch (e) { console.error("이름 로딩 실패", e); }
  };

  const updateName = async () => {
    if (!name.trim()) {
      Alert.alert('알림', '이름을 입력해주세요.');
      return;
    }
    try {
      await AsyncStorage.setItem('user_name', name.trim());
      Alert.alert('성공', '이름이 변경되었습니다.');
    } catch (e) { Alert.alert('오류', '이름 저장에 실패했습니다.'); }
  };

  // 🏥 [데이터 검색 로직] (영환님의 기존 기능 유지)
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const results: any[] = [];
      const schedules = db.getAllSync<any>("SELECT '일정' as type, title, date as sub FROM schedules WHERE title LIKE ? OR note LIKE ?", [`%${text}%`, `%${text}%`]);
      const memos = db.getAllSync<any>("SELECT '메모' as type, title, createdAt as sub FROM memos WHERE title LIKE ? OR content LIKE ?", [`%${text}%`, `%${text}%`]);
      const tasks = db.getAllSync<any>("SELECT '과제' as type, title, category as sub FROM portfolio_tasks WHERE title LIKE ?", [`%${text}%`]);
      setSearchResults([...schedules, ...memos, ...tasks]);
    } catch (e) { console.error(e); }
  };

  const openUPortfolio = () => {
    Linking.openURL('https://inje.u-folio.com/').catch(() => Alert.alert('오류', '페이지를 열 수 없습니다.'));
  };

  // 💾 [데이터 백업 로직] (영환님의 공들인 로직 유지)
  const handleBackup = async () => {
    try {
      let schedules: any[] = [];
      let memos: any[] = [];
      let tasks: any[] = [];
      let rotations: any[] = [];

      try { schedules = db.getAllSync("SELECT * FROM schedules"); } catch(e) {}
      try { memos = db.getAllSync("SELECT * FROM memos"); } catch(e) {}
      try { tasks = db.getAllSync("SELECT * FROM portfolio_tasks"); } catch(e) {}
      try { rotations = db.getAllSync("SELECT * FROM rotations"); } catch(e) {}
      
      const userName = await AsyncStorage.getItem('user_name');

      const backupData = {
        exportDate: new Date().toISOString(),
        userName: userName,
        data: { schedules, memos, tasks, rotations }
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const dateString = new Date().toISOString().split('T')[0];
      const fileUri = `${(FileSystem as any).documentDirectory}PKNote_Backup_${dateString}.json`;
      
      await FileSystem.writeAsStringAsync(fileUri, jsonString, { encoding: 'utf8' });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: '데이터 백업하기',
          UTI: 'public.json'
        });
      } else {
        Alert.alert('알림', '이 기기에서는 공유 기능을 지원하지 않습니다.');
      }
    } catch (e) {
      Alert.alert('오류', '데이터를 백업하는 중 문제가 발생했습니다.');
    }
  };

  // 📂 [데이터 가져오기 로직] (새로 추가된 기능, 강력한 경고 포함)
  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      const fileContent = await FileSystem.readAsStringAsync(fileUri, { encoding: 'utf8' });
      const backup = JSON.parse(fileContent);

      if (!backup.data) {
        throw new Error('올바른 백업 파일이 아닙니다.');
      }

      // ⚠️ 영환님의 요청대로 강력한 삭제 경고 추가
      Alert.alert(
        '⚠️ 데이터 복원 (영구 삭제 주의)',
        '이 파일을 불러오면 현재 앱에 저장된 모든 일정, 메모, 체크리스트 데이터가 즉시 삭제되고 백업 데이터로 교체됩니다.\n\n정말로 진행하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { 
            text: '삭제 후 복원', 
            style: 'destructive', 
            onPress: async () => {
              try {
                // 1. 기존 데이터 삭제 (영구 삭제)
                db.runSync("DELETE FROM schedules");
                db.runSync("DELETE FROM memos");
                db.runSync("DELETE FROM portfolio_tasks");
                db.runSync("DELETE FROM rotations");

                // 2. 백업 데이터 삽입
                const { schedules, memos, tasks, rotations } = backup.data;

                db.withTransactionSync(() => {
                  schedules?.forEach((s: any) => db.runSync("INSERT INTO schedules (title, date, note) VALUES (?, ?, ?)", [s.title, s.date, s.note]));
                  memos?.forEach((m: any) => db.runSync("INSERT INTO memos (title, content, createdAt) VALUES (?, ?, ?)", [m.title, m.content, m.createdAt]));
                  tasks?.forEach((t: any) => db.runSync("INSERT INTO portfolio_tasks (title, category, deadlineInfo, requiredCount, currentCount, completed, isCustom, deadlineTimestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [t.title, t.category, t.deadlineInfo, t.requiredCount, t.currentCount, t.completed, t.isCustom, t.deadlineTimestamp]));
                  rotations?.forEach((r: any) => db.runSync("INSERT INTO rotations (date, hospital, dept, color, textColor) VALUES (?, ?, ?, ?, ?)", [r.date, r.hospital, r.dept, r.color, r.textColor]));
                });

                if (backup.userName) await AsyncStorage.setItem('user_name', backup.userName);
                
                Alert.alert('성공', '모든 데이터가 성공적으로 복원되었습니다.', [
                  { text: '확인', onPress: () => router.replace('/') }
                ]);
              } catch (err) {
                Alert.alert('오류', '데이터 복원 과정에서 오류가 발생했습니다.');
              }
            }
          }
        ]
      );
    } catch (e) {
      Alert.alert('오류', '파일을 읽는 중 문제가 발생했습니다.');
    }
  };

  const resetAllData = () => {
    Alert.alert('⚠️ 전체 데이터 초기화', '이름, 일정, 체크리스트 등 모든 데이터가 삭제됩니다. 계속하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '초기화', style: 'destructive', onPress: async () => {
          try {
            await AsyncStorage.clear();
            Alert.alert('완료', '데이터가 초기화되었습니다.');
            router.replace('/'); 
          } catch (e) { console.error(e); }
        } 
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
        <Text style={styles.title}>설정</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>학교 공식 시스템</Text>
          <TouchableOpacity style={styles.linkCard} onPress={openUPortfolio}>
            <View style={styles.linkIconBox}><Ionicons name="school" size={22} color="#fff" /></View>
            <View style={{ flex: 1 }}><Text style={styles.linkTitle}>인제 U-포트폴리오</Text><Text style={styles.linkSub}>inje.u-folio.com</Text></View>
            <Ionicons name="open-outline" size={20} color="#BBB" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>내 정보 수정</Text>
          <View style={styles.inputRow}>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="이름 입력" placeholderTextColor="#ABB2B9" />
            <TouchableOpacity style={styles.saveBtn} onPress={updateName}><Text style={styles.saveBtnText}>저장</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>임상 학습 도구</Text>
          <TouchableOpacity style={styles.linkCard} onPress={() => router.push('/storage' as any)}>
            <View style={[styles.linkIconBox, { backgroundColor: '#9B59B6' }]}><Ionicons name="folder-open" size={22} color="#fff" /></View>
            <View style={{ flex: 1 }}><Text style={styles.linkTitle}>파일 저장소 (Clinical Box)</Text><Text style={styles.linkSub}>교수님 연락처, 스키마, 인계록 보관함</Text></View>
            <Ionicons name="chevron-forward" size={20} color="#BBB" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.linkCard} onPress={() => setSearchVisible(true)}>
            <View style={[styles.linkIconBox, { backgroundColor: '#F39C12' }]}><Ionicons name="search" size={22} color="#fff" /></View>
            <View style={{ flex: 1 }}><Text style={styles.linkTitle}>데이터 검색 (Quick Find)</Text><Text style={styles.linkSub}>내 모든 기록에서 키워드 찾기</Text></View>
            <Ionicons name="chevron-forward" size={20} color="#BBB" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>실습 일정 관리</Text>
          <TouchableOpacity style={styles.linkCard} onPress={() => router.push('/edit-rotations' as any)}>
            <View style={[styles.linkIconBox, { backgroundColor: '#4A90E2' }]}><Ionicons name="calendar" size={22} color="#fff" /></View>
            <View style={{ flex: 1 }}><Text style={styles.linkTitle}>실습 일정 수정하기</Text><Text style={styles.linkSub}>등록된 병원 및 실습과 변경/삭제</Text></View>
            <Ionicons name="chevron-forward" size={20} color="#BBB" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>데이터 관리</Text>
          
          <TouchableOpacity style={styles.backupBtn} onPress={handleBackup}>
            <Ionicons name="cloud-download-outline" size={22} color="#27AE60" />
            <Text style={styles.backupBtnText}>데이터 백업하기 (내보내기)</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* 💡 새로 추가된 가져오기 버튼 */}
          <TouchableOpacity style={styles.importBtn} onPress={handleImport}>
            <Ionicons name="cloud-upload-outline" size={22} color="#2980B9" />
            <Text style={styles.importBtnText}>데이터 가져오기 (복원하기)</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.resetBtn} onPress={resetAllData}>
            <Ionicons name="refresh-circle-outline" size={22} color="#E74C3C" />
            <Text style={styles.resetBtnText}>앱 데이터 전체 초기화 (주의!!!)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}><Text style={styles.footerText}>인제의대 스마트 비서 v1.0</Text></View>
      </ScrollView>

      {/* 🔍 통합 검색 모달 (기존 기능 유지) */}
      <Modal visible={isSearchVisible} animationType="slide" onRequestClose={() => setSearchVisible(false)}>
        <SafeAreaView style={styles.searchContainer}>
          <View style={styles.searchHeader}>
            <TextInput style={styles.searchInput} placeholder="검색어를 입력하세요..." value={searchQuery} onChangeText={handleSearch} autoFocus />
            <TouchableOpacity onPress={() => {setSearchVisible(false); setSearchQuery(''); setSearchResults([]);}}><Text style={styles.closeText}>닫기</Text></TouchableOpacity>
          </View>
          <FlatList
            data={searchResults}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item }) => (
              <View style={styles.resultItem}>
                <View style={[styles.typeBadge, { backgroundColor: item.type === '일정' ? '#4A90E2' : item.type === '메모' ? '#9B59B6' : '#27AE60' }]}><Text style={styles.typeText}>{item.type}</Text></View>
                <View style={{ flex: 1 }}><Text style={styles.resultTitle}>{item.title}</Text><Text style={styles.resultSub}>{item.sub}</Text></View>
              </View>
            )}
            ListEmptyComponent={() => (<View style={styles.emptyBox}><Ionicons name="search-outline" size={50} color="#EEE" /><Text style={styles.emptyText}>결과가 없습니다.</Text></View>)}
            contentContainerStyle={{ padding: 20 }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 20, paddingTop: 55, paddingBottom: 15, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#eee' },
  backBtn: { padding: 5 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' },
  content: { padding: 20 },
  section: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  sectionTitle: { fontSize: 13, color: '#888', marginBottom: 15, fontWeight: '700', letterSpacing: 0.5 },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  linkIconBox: { backgroundColor: '#003594', padding: 10, borderRadius: 12 },
  linkTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  linkSub: { fontSize: 12, color: '#999', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F2F5F8', marginVertical: 15 },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, backgroundColor: '#F2F5F8', borderRadius: 12, padding: 12, fontSize: 16, color: '#003594', fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#003594', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 12 },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
  backupBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  backupBtnText: { color: '#27AE60', fontWeight: 'bold', fontSize: 16 },
  importBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  importBtnText: { color: '#2980B9', fontWeight: 'bold', fontSize: 16 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  resetBtnText: { color: '#E74C3C', fontWeight: 'bold', fontSize: 16 },
  footer: { marginTop: 30, alignItems: 'center', paddingBottom: 40 },
  footerText: { fontSize: 12, color: '#CCC' },
  searchContainer: { flex: 1, backgroundColor: '#FFF' },
  searchHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE', gap: 15 },
  searchInput: { flex: 1, backgroundColor: '#F2F5F8', borderRadius: 15, paddingHorizontal: 20, height: 45, fontSize: 16 },
  closeText: { color: '#888', fontWeight: 'bold' },
  resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F8F9FA', gap: 15 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  typeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  resultTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  resultSub: { fontSize: 12, color: '#999', marginTop: 2 },
  emptyBox: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#CCC', marginTop: 10, fontSize: 16 }
});