import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';

// 🗄️ 통합 데이터베이스 연결
const db = SQLite.openDatabaseSync('medical_assistant_v2.db');

const HOSPITALS = ['부산', '상계', '일산', '해운대', '해당없음'];
const DEPARTMENTS = ['내과', '내과1', '내과2', '외과', '산부인과', '소아청소년과', '정신건강의학과', '응급의학과', '지역의료', '진료역량개발과정', '방학'];

const DEPT_COLORS: { [key: string]: { bg: string, text: string } } = {
  '내과': { bg: '#E3F2FD', text: '#1565C0' },
  '내과1': { bg: '#E3F2FD', text: '#1565C0' },
  '내과2': { bg: '#EDE7F6', text: '#4527A0' },
  '외과': { bg: '#EFEBE9', text: '#4E342E' },
  '산부인과': { bg: '#FCE4EC', text: '#AD1457' },
  '소아청소년과': { bg: '#FFF9C4', text: '#F57F17' },
  '정신건강의학과': { bg: '#E8F5E9', text: '#2E7D32' },
  '응급의학과': { bg: '#E0F2F1', text: '#00695C' },
  '지역의료': { bg: '#E0F7FA', text: '#00838F' },
  '진료역량개발과정': { bg: '#E8EAF6', text: '#3949AB' },
  '방학': { bg: '#F5F5F5', text: '#616161' },
};

export default function EditRotationsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  
  const [rotations, setRotations] = useState<{[key: string]: any}>({});
  const [tempStart, setTempStart] = useState<string | null>(null);
  const [tempEnd, setTempEnd] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedHosp, setSelectedHosp] = useState('부산');
  const [selectedDept, setSelectedDept] = useState('내과');

  useEffect(() => {
    if (isFocused) {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS rotations (
          date TEXT PRIMARY KEY,
          hospital TEXT,
          dept TEXT,
          color TEXT,
          textColor TEXT
        );
      `);
      loadRotations();
    }
  }, [isFocused]);

  const loadRotations = () => {
    try {
      const rows = db.getAllSync<any>("SELECT * FROM rotations");
      const rotationMap: any = {};
      rows.forEach(row => {
        rotationMap[row.date] = { 
          hospital: row.hospital, 
          dept: row.dept, 
          color: row.color, 
          textColor: row.textColor 
        };
      });
      setRotations(rotationMap);
    } catch (e) { console.error("실습 로드 실패", e); }
  };

  const onDayPress = (day: any) => {
    const dateStr = day.dateString;
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dateStr); setTempEnd(null);
    } else {
      if (dateStr < tempStart) setTempStart(dateStr);
      else { setTempEnd(dateStr); setShowModal(true); }
    }
  };

  const getDatesInRange = (start: string, end: string) => {
    const dates = [];
    let curr = new Date(start);
    const endDate = new Date(end);
    while (curr <= endDate) {
      const year = curr.getFullYear();
      const month = String(curr.getMonth() + 1).padStart(2, '0');
      const day = String(curr.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  };

  const handleSaveRotation = () => {
    if (!tempStart || !tempEnd) return;
    const dates = getDatesInRange(tempStart, tempEnd);
    const newRotations = { ...rotations };
    const selectedColor = DEPT_COLORS[selectedDept] || { bg: '#E3F2FD', text: '#1565C0' };
    
    dates.forEach((date) => {
      newRotations[date] = { hospital: selectedHosp, dept: selectedDept, color: selectedColor.bg, textColor: selectedColor.text };
    });

    setRotations(newRotations);
    closeModal();
  };

  const handleDeleteRotation = () => {
    if (!tempStart || !tempEnd) return;
    const dates = getDatesInRange(tempStart, tempEnd);
    const newRotations = { ...rotations };
    dates.forEach((date) => { delete newRotations[date]; });
    setRotations(newRotations);
    closeModal();
  };

  const closeModal = () => {
    setShowModal(false); setTempStart(null); setTempEnd(null);
  };

  // 🧠 [스마트 로직] 저장된 일정 기반으로 포트폴리오 퀘스트 자동 조정
  const syncPortfolioWithRotation = () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const todayRotation = rotations[todayStr];
    if (!todayRotation) return;

    const currentDept = todayRotation.dept;
    
    let endDateStr = todayStr;
    let curr = new Date(today);
    while (true) {
      curr.setDate(curr.getDate() + 1);
      const nextStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
      if (rotations[nextStr] && rotations[nextStr].dept === currentDept) {
        endDateStr = nextStr;
      } else {
        break;
      }
    }

    const endTarget = new Date(endDateStr);
    endTarget.setHours(23, 59, 59, 999);
    const endTs = endTarget.getTime();

    const DEPT_RULES: any = {
      '내과': { outpatient: 24, surgery: 0, pomr: 12 }, 
      '내과1': { outpatient: 12, surgery: 0, pomr: 6 }, 
      '내과2': { outpatient: 12, surgery: 0, pomr: 6 },
      '외과': { outpatient: 4, surgery: 6, pomr: 4 },
      '산부인과': { outpatient: 6, surgery: 5, pomr: 2 },
      '소아청소년과': { outpatient: 4, surgery: 0, pomr: 4 },
      '정신건강의학과': { outpatient: 4, surgery: 0, pomr: 4 },
      '응급의학과': { outpatient: 2, surgery: 0, pomr: 1 },
      'default': { outpatient: 2, surgery: 0, pomr: 1 }
    };

    const rules = DEPT_RULES[currentDept] || DEPT_RULES['default'];

    try {
      db.runSync("UPDATE portfolio_tasks SET category = 'event' WHERE title LIKE '%POMR%'");
      db.runSync("UPDATE portfolio_tasks SET requiredCount = ? WHERE title LIKE '%외래예진기록%'", rules.outpatient);
      db.runSync("UPDATE portfolio_tasks SET requiredCount = ? WHERE title LIKE '%수술참관기록%'", rules.surgery);
      db.runSync("UPDATE portfolio_tasks SET requiredCount = ? WHERE title LIKE '%POMR%'", rules.pomr);

      db.runSync(
        "UPDATE portfolio_tasks SET deadlineTimestamp = ?, deadlineInfo = ? WHERE category = 'end'",
        endTs,
        `${endTarget.getMonth() + 1}/${endTarget.getDate()} 턴 종료 마감`
      );
    } catch (e) {
      console.log("포트폴리오 동기화 에러:", e);
    }
  };

  const handleFinishEdit = () => {
    try {
      db.withTransactionSync(() => {
        db.runSync("DELETE FROM rotations");
        
        Object.keys(rotations).forEach(date => {
          const item = rotations[date];
          db.runSync(
            "INSERT INTO rotations (date, hospital, dept, color, textColor) VALUES (?, ?, ?, ?, ?)",
            date, item.hospital, item.dept, item.color, item.textColor
          );
        });
      });

      syncPortfolioWithRotation();

      Alert.alert('완료', '실습 일정이 DB에 안전하게 저장되었습니다.', [
        { text: '확인', onPress: () => router.back() }
      ]);
    } catch (e) { 
      console.error(e);
      Alert.alert('오류', '데이터베이스 저장에 실패했습니다.'); 
    }
  };

  const getMarkedDates = () => {
    let marks: any = {};
    Object.keys(rotations).forEach(date => {
      marks[date] = { 
        startingDay: true, 
        endingDay: true, 
        color: rotations[date].color || '#E3F2FD', 
        textColor: rotations[date].textColor || '#1565C0' 
      };
    });
    if (tempStart) marks[tempStart] = { startingDay: true, color: '#003594', textColor: 'white' };
    if (tempEnd) marks[tempEnd] = { endingDay: true, color: '#003594', textColor: 'white' };
    return marks;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.titleSmall}>실습 일정 수정</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.calendarWrapper}>
        <Calendar markingType={'period'} markedDates={getMarkedDates()} onDayPress={onDayPress} theme={{ selectedDayBackgroundColor: '#003594', todayTextColor: '#E74C3C', arrowColor: '#003594' }} />
      </View>

      {/* 💡 [신규] 명확한 가이드라인 멘트 추가 */}
      <View style={styles.infoBox}>
        <Text style={styles.helperText}>💡 수정하거나 지울 기간의 시작일과 종료일을 터치하세요.</Text>
        <Text style={styles.warningText}>⚠️ 정확한 주간 과제 마감일 계산을 위해, 일정은 반드시 {'\n'}<Text style={styles.highlightText}>'월요일 시작 ~ 일요일 종료'</Text>로 꽉 채워서 설정해주세요.</Text>
      </View>

      <TouchableOpacity style={styles.btnFinish} onPress={handleFinishEdit}>
        <Text style={styles.btnText}>변경사항 저장하기</Text>
      </TouchableOpacity>

      <Modal visible={showModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>일정 수정 / 삭제</Text>
            <Text style={styles.modalDate}>{tempStart} ~ {tempEnd}</Text>

            <Text style={styles.sectionLabel}>병원 선택</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
              {HOSPITALS.map(hosp => (
                <TouchableOpacity key={hosp} style={[styles.tagBtn, selectedHosp === hosp && styles.tagBtnActive]} onPress={() => setSelectedHosp(hosp)}>
                  <Text style={[styles.tagText, selectedHosp === hosp && styles.tagTextActive]}>{hosp}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionLabel}>실습과 선택</Text>
            <View style={styles.deptGrid}>
              {DEPARTMENTS.map(dept => (
                <TouchableOpacity key={dept} style={[styles.tagBtn, selectedDept === dept && styles.tagBtnActive, { marginBottom: 10 }]} onPress={() => setSelectedDept(dept)}>
                  <Text style={[styles.tagText, selectedDept === dept && styles.tagTextActive]}>{dept}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalBtnDelete} onPress={handleDeleteRotation}>
                <Text style={styles.modalBtnDeleteText}>일정 지우기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleSaveRotation}>
                <Text style={styles.btnText}>저장 (덮어쓰기)</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.modalBtnCancelOnly} onPress={closeModal}>
              <Text style={styles.modalBtnCancelText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA', padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 40, marginBottom: 20 },
  backBtn: { padding: 5 },
  titleSmall: { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A' },
  calendarWrapper: { backgroundColor: '#fff', borderRadius: 20, padding: 10, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  
  // 💡 가이드라인 스타일 추가
  infoBox: { marginTop: 15, paddingHorizontal: 10 },
  helperText: { textAlign: 'center', color: '#666', fontSize: 14, marginBottom: 8 },
  warningText: { textAlign: 'center', color: '#E74C3C', fontSize: 13, lineHeight: 18 },
  highlightText: { fontWeight: 'bold', textDecorationLine: 'underline' },

  btnFinish: { backgroundColor: '#003594', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 'auto', marginBottom: 20 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 25 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  modalDate: { fontSize: 14, color: '#003594', fontWeight: 'bold', marginBottom: 20 },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#888', marginBottom: 10, marginTop: 10 },
  scrollRow: { maxHeight: 50, marginBottom: 10 },
  deptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tagBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, backgroundColor: '#F2F5F8', borderWidth: 1, borderColor: '#E1E8EE' },
  tagBtnActive: { backgroundColor: '#003594', borderColor: '#003594' },
  tagText: { color: '#555', fontSize: 14 },
  tagTextActive: { color: '#fff', fontWeight: 'bold' },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalBtnDelete: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#FFEBEE', alignItems: 'center' },
  modalBtnDeleteText: { color: '#C62828', fontSize: 16, fontWeight: 'bold' },
  modalBtnSave: { flex: 2, padding: 16, borderRadius: 12, backgroundColor: '#003594', alignItems: 'center' },
  modalBtnCancelOnly: { marginTop: 10, padding: 16, alignItems: 'center' },
  modalBtnCancelText: { color: '#888', fontSize: 16, fontWeight: 'bold' },
});