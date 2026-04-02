import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';

// 🗄️ 통합 데이터베이스 연결
const db = SQLite.openDatabaseSync('medical_assistant_v2.db');

const CATEGORIES = [
  { label: '시험', value: 'exam', color: '#E74C3C' },
  { label: '실습', value: 'practice', color: '#27AE60' },
  { label: '개인/기타', value: 'personal', color: '#4A90E2' },
];

export default function CalendarScreen() {
  const isFocused = useIsFocused();

  // 💡 한국 로컬 시간 기준으로 날짜 생성
  const getTodayStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = getTodayStr();
  
  const [selected, setSelected] = useState(today);
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [isDetailVisible, setDetailVisible] = useState(false);
  
  const [rotations, setRotations] = useState<{[key: string]: any}>({});
  const [schedules, setSchedules] = useState<{[key: string]: any[]}>({});
  const [pastMemos, setPastMemos] = useState<any[]>([]); 

  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newNote, setNewNote] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[2]);

  // 🏥 1. 테이블 생성 및 로드
  useEffect(() => {
    try {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS schedules (
          id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
          title TEXT NOT NULL, location TEXT, note TEXT, category TEXT, color TEXT
        );
        CREATE TABLE IF NOT EXISTS rotations (
          date TEXT PRIMARY KEY, hospital TEXT, dept TEXT, color TEXT
        );
        CREATE TABLE IF NOT EXISTS memos (
          id TEXT PRIMARY KEY, title TEXT, content TEXT, category TEXT, color TEXT, createdAt TEXT
        );
      `);
    } catch (e) { console.log("DB 초기화 에러:", e); }
    
    if (isFocused) {
      loadAllData();
      // 💡 [에러 해결 1] 문자열 비교 대신 Date 파싱 후 비교로 안정성 확보
      if (new Date(selected).getTime() <= new Date(today).getTime()) {
        loadDayMemos(selected);
      }
    }
  }, [isFocused]);

  const loadAllData = () => {
    try {
      const rotationRows = db.getAllSync<any>("SELECT * FROM rotations");
      const rotationMap: any = {};
      rotationRows.forEach(row => { rotationMap[row.date] = row; });
      setRotations(rotationMap);

      const scheduleRows = db.getAllSync<any>("SELECT * FROM schedules");
      const scheduleMap: any = {};
      scheduleRows.forEach(row => {
        if (!scheduleMap[row.date]) scheduleMap[row.date] = [];
        scheduleMap[row.date].push(row);
      });
      setSchedules(scheduleMap);
    } catch (e) { console.error("일정 로드 에러:", e); }
  };

  const loadDayMemos = (dateStr: string) => {
    // 💡 [에러 해결 2] 혹시 dateStr이 빈 값이 넘어왔을 경우 쿼리 실행 방지 (NullPointerException 방어)
    if (!dateStr) {
      setPastMemos([]);
      return;
    }
    try {
      const memos = db.getAllSync<any>("SELECT * FROM memos WHERE createdAt LIKE ?", `${dateStr}%`);
      setPastMemos(memos || []);
    } catch (e) { 
      console.error("메모 로드 에러:", e);
      setPastMemos([]); 
    }
  };

  const saveSchedule = () => {
    if (!selected || !newTitle.trim()) {
      Alert.alert('알림', '일정 제목을 입력해주세요.');
      return;
    }
    try {
      db.runSync(
        "INSERT INTO schedules (date, title, location, note, category, color) VALUES (?, ?, ?, ?, ?, ?)",
        [selected, newTitle, newLocation, newNote, selectedCategory.value, selectedCategory.color] // 💡 쿼리 파라미터를 배열로 묶어 전달(오류 방지)
      );
      loadAllData();
      setNewTitle(''); setNewLocation(''); setNewNote(''); setSelectedCategory(CATEGORIES[2]);
      setAddModalVisible(false);
    } catch (e) { Alert.alert('오류', '일정 저장에 실패했습니다.'); }
  };

  const deleteSchedule = (date: string, eventId: number) => {
    Alert.alert("일정 삭제", "이 일정을 삭제하시겠습니까?", [
      { text: "취소" },
      { text: "삭제", onPress: () => {
          try {
            db.runSync("DELETE FROM schedules WHERE id = ?", [eventId]); // 배열 형태로 전달
            loadAllData();
          } catch(e) { console.error("일정 삭제 에러", e) }
        }, style: 'destructive' }
    ]);
  };

  const adjustDate = (dateStr: string, days: number) => {
    if(!dateStr) return '';
    const parts = dateStr.split('-');
    if(parts.length !== 3) return '';
    
    const [y, m, d] = parts.map(Number);
    const date = new Date(y, m - 1, d + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const getMarkedDates = () => {
    let marks: any = {};
    Object.keys(rotations).forEach(date => {
      const prevStr = adjustDate(date, -1);
      const nextStr = adjustDate(date, 1);
      const isStart = !rotations[prevStr] || rotations[prevStr].dept !== rotations[date].dept;
      const isEnd = !rotations[nextStr] || rotations[nextStr].dept !== rotations[date].dept;
      marks[date] = { ...marks[date], rotationColor: rotations[date].color, isStart, isEnd };
    });
    Object.keys(schedules).forEach(date => {
      if (schedules[date] && schedules[date].length > 0) {
        marks[date] = { ...marks[date], hasEvent: true, dotColor: schedules[date][0].color };
      }
    });
    return marks;
  };

  const markedData = getMarkedDates();
  
  const handleDayPress = (dateStr: string) => {
    if(!dateStr) return;
    setSelected(dateStr);
    
    // 💡 [에러 해결 3] 안전한 날짜 대소 비교
    if (new Date(dateStr).getTime() <= new Date(today).getTime()) {
      loadDayMemos(dateStr);
    } else {
      setPastMemos([]);
    }
    setDetailVisible(true);
  };

  // --- 화면 렌더링 (UI 코드는 영환님 원본 100% 동일하게 유지) ---
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>일정</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setAddModalVisible(true)}>
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.calendarWrapper}>
        <Calendar
          current={today}
          onDayPress={day => handleDayPress(day.dateString)}
          theme={{ arrowColor: '#003594', todayTextColor: '#003594', calendarBackground: '#F8F9FA' }}
          dayComponent={({ date, state }: any) => {
            const dateStr = date.dateString;
            const isSelected = dateStr === selected;
            const isToday = dateStr === today;
            const mark = markedData[dateStr] || {};
            
            return (
              <TouchableOpacity onPress={() => handleDayPress(dateStr)} style={styles.dayCell}>
                {mark.rotationColor && mark.isStart && <Text style={[styles.startBracket, { color: mark.rotationColor }]}>{'('}</Text>}
                {mark.rotationColor && mark.isEnd && <Text style={[styles.endBracket, { color: mark.rotationColor }]}>{')'}</Text>}
                <View style={styles.topDotArea}>
                  {mark.hasEvent && <View style={[styles.eventDot, { backgroundColor: mark.dotColor }]} />}
                </View>
                <View style={[styles.dateTextWrapper, isSelected && styles.selectedBg]}>
                  <Text style={[styles.dateText, state === 'disabled' && styles.disabledText, isToday && !isSelected && styles.todayText, isSelected && styles.selectedText]}>
                    {date.day}
                  </Text>
                </View>
                <View style={{ height: 6 }} />
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <View style={styles.quickInfoBar}>
        {rotations[selected] ? (
          <View style={styles.quickInfoContent}>
            <Ionicons name="medical" size={18} color={rotations[selected].color} />
            <Text style={styles.quickInfoText}>
              {rotations[selected].hospital}백병원 <Text style={{fontWeight:'800'}}>{rotations[selected].dept}</Text> 실습 중
            </Text>
          </View>
        ) : (
          <Text style={styles.quickInfoEmpty}>실습 일정이 없습니다.</Text>
        )}
      </View>

      <Modal visible={isDetailVisible} animationType="slide" transparent={true} onRequestClose={() => setDetailVisible(false)}>
        <View style={styles.modalOverlayDetail}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setDetailVisible(false)} /> 
          <View style={styles.modalContentDetail}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.detailsDateText}>
                {selected} {selected === today ? '(오늘)' : selected > today ? '(예정)' : '(과거)'}
              </Text>
              <TouchableOpacity onPress={() => setDetailVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#BBB" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>병원 실습</Text>
                {rotations[selected] ? (
                  <View style={[styles.infoCardSimple, { borderLeftColor: rotations[selected].color }]}>
                    <Text style={styles.infoTitleSimple}>{rotations[selected].hospital}백병원 - {rotations[selected].dept}</Text>
                  </View>
                ) : <Text style={styles.emptyText}>실습 일정이 없습니다.</Text>}
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeaderFlex}>
                  <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                    개인 일정 <Text style={{color:'#003594'}}>[{schedules[selected]?.length || 0}]</Text>
                  </Text>
                  <TouchableOpacity onPress={() => setAddModalVisible(true)} style={styles.addMiniBtn}>
                    <Ionicons name="add" size={16} color="#FFF" />
                    <Text style={styles.addMiniBtnText}>추가</Text>
                  </TouchableOpacity>
                </View>

                {schedules[selected] && schedules[selected].length > 0 ? (
                  schedules[selected].map((item: any) => (
                    <View key={item.id} style={[styles.infoCard, { borderLeftColor: item.color || '#4A90E2', borderLeftWidth: 5, marginBottom: 10 }]}>
                      <View style={styles.infoContent}>
                        <View style={styles.categoryBadge}><Text style={[styles.categoryBadgeText, { color: item.color }]}>{CATEGORIES.find(c => c.value === item.category)?.label || '일반'}</Text></View>
                        <Text style={styles.infoTitle}>{item.title}</Text>
                        <Text style={styles.infoTextSmall}>📍 {item.location || '장소 미지정'}</Text>
                      </View>
                      <TouchableOpacity onPress={() => deleteSchedule(selected, item.id)}>
                        <Ionicons name="trash-outline" size={20} color="#E74C3C" />
                      </TouchableOpacity>
                    </View>
                  ))
                ) : <Text style={styles.emptyText}>등록된 일정이 없습니다.</Text>}
              </View>

              {/* 과거 메모장 표시 (안전한 날짜 비교 반영됨) */}
              {new Date(selected).getTime() <= new Date(today).getTime() && pastMemos.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>그날의 메모장 <Text style={{color:'#9B59B6'}}>[{pastMemos.length}]</Text></Text>
                  {pastMemos.map(memo => (
                    <View key={memo.id} style={[styles.memoCard, { borderLeftColor: memo.color }]}>
                      <Text style={[styles.memoCat, { color: memo.color }]}>{memo.category}</Text>
                      <Text style={styles.memoCardTitle}>{memo.title}</Text>
                      <View style={styles.memoDivider} />
                      <Text style={styles.memoBody}>{memo.content}</Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={{ height: 50 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 일정 추가 모달창 */}
      <Modal visible={isAddModalVisible} animationType="fade" transparent={true} onRequestClose={() => setAddModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "android" ? "height" : "padding"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeaderTitle}>{selected} 일정 추가</Text>
            <View style={styles.categoryContainer}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity key={cat.value} style={[styles.catBtn, selectedCategory.value === cat.value && { backgroundColor: cat.color, borderColor: cat.color }]} onPress={() => setSelectedCategory(cat)}>
                  <Text style={[styles.catBtnText, selectedCategory.value === cat.value && { color: '#fff' }]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} placeholder="일정 제목" value={newTitle} onChangeText={setNewTitle} />
            <TextInput style={styles.input} placeholder="장소" value={newLocation} onChangeText={setNewLocation} />
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="메모" multiline value={newNote} onChangeText={setNewNote} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddModalVisible(false)}><Text style={styles.cancelBtnText}>취소</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveSchedule}><Text style={styles.saveBtnText}>저장</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 20, paddingTop: 55, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A' },
  addButton: { backgroundColor: '#003594', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  calendarWrapper: { backgroundColor: '#F8F9FA', paddingTop: 10 },
  quickInfoBar: { padding: 20, backgroundColor: '#FFF', margin: 20, borderRadius: 15, elevation: 2 },
  quickInfoContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickInfoText: { fontSize: 16, color: '#333' },
  quickInfoEmpty: { fontSize: 14, color: '#BBB', textAlign: 'center' },
  dayCell: { width: 40, height: 55, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  startBracket: { position: 'absolute', left: -4, top: 12, fontSize: 30, fontWeight: 'bold' },
  endBracket: { position: 'absolute', right: -4, top: 12, fontSize: 30, fontWeight: 'bold' },
  topDotArea: { height: 6, justifyContent: 'center', marginBottom: 2 },
  eventDot: { width: 5, height: 5, borderRadius: 2.5 },
  dateTextWrapper: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  selectedBg: { backgroundColor: '#003594' },
  dateText: { fontSize: 17, color: '#333' },
  disabledText: { color: '#D1D9E6' },
  todayText: { color: '#003594', fontWeight: 'bold' },
  selectedText: { color: '#fff', fontWeight: 'bold' },
  modalOverlayDetail: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContentDetail: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, height: '80%' },
  modalHandle: { width: 40, height: 5, backgroundColor: '#EEE', borderRadius: 3, alignSelf: 'center', marginBottom: 15 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  detailsDateText: { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A' },
  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#AAA', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
  sectionHeaderFlex: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addMiniBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#003594', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 4 },
  addMiniBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  infoCardSimple: { backgroundColor: '#F8F9FA', padding: 15, borderRadius: 12, borderLeftWidth: 5 },
  infoTitleSimple: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  infoCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 15, elevation: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#F2F5F8' },
  infoContent: { flex: 1 },
  categoryBadge: { marginBottom: 3 },
  categoryBadgeText: { fontSize: 11, fontWeight: 'bold' },
  infoTitle: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  infoTextSmall: { fontSize: 13, color: '#666', marginTop: 2 },
  memoCard: { backgroundColor: '#FDFDFD', padding: 18, borderRadius: 15, marginBottom: 12, borderLeftWidth: 5, elevation: 2 },
  memoCat: { fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  memoCardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  memoDivider: { height: 1, backgroundColor: '#EEE', marginVertical: 10 },
  memoBody: { fontSize: 14, color: '#555', lineHeight: 22 },
  emptyText: { color: '#CCC', fontSize: 14, fontStyle: 'italic', paddingLeft: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 25, padding: 25, gap: 15 },
  modalHeaderTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  categoryContainer: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  catBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 15, borderWidth: 1, borderColor: '#eee' },
  catBtnText: { fontSize: 14, color: '#888', fontWeight: 'bold' },
  input: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 15, fontSize: 15, borderWidth: 1, borderColor: '#EFF2F5' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 15, backgroundColor: '#F2F5F8', alignItems: 'center' },
  cancelBtnText: { color: '#888', fontWeight: 'bold' },
  saveBtn: { flex: 2, padding: 16, borderRadius: 15, backgroundColor: '#003594', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
});