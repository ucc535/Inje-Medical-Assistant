import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');
const MODAL_WIDTH = width * 0.9; 

const TAB_LIST = [
  { id: 'home', title: '1. 홈', icon: 'home' },
  { id: 'calendar', title: '2. 캘린더', icon: 'calendar' },
  { id: 'portfolio', title: '3. 포트폴리오', icon: 'list' },
  { id: 'timetable', title: '4. 시간표', icon: 'timer' },
  { id: 'memo', title: '5. 메모', icon: 'pencil' },
  { id: 'meal', title: '6. 식단', icon: 'restaurant' },
  { id: 'settings', title: '7. 설정창', icon: 'settings' },
];

const TUTORIAL_CONTENT: any = {
  home: {
    title: '홈 화면',
    features: [
      { id: 1, text: '스마트 우산 알림: 실습 일정에 저장된 병원 날씨를 분석해 비 소식이 있다면 우산을 챙기라고 알려드려요.' },
      { id: 2, text: '위치 기반 날씨: 일정에 장소가 없다면 기본 장소(상계)를 기준으로 날씨를 표시합니다.' },
      { id: 3, text: '오늘 일정 표시: 오늘 등록된 실습, 시험, 개인 일정을 한눈에 볼 수 있도록 나열합니다.' },
      { id: 4, text: '🚨 과제 마감 배너: 마감 2시간 이내의 과제가 있다면 상단에 붉은색 배너를 띄워 학점을 수호합니다🛡️.' },
    ]
  },
  calendar: {
    title: '캘린더 화면',
    features: [
      { id: 1, text: '괄호() 로테이션 UI: 실습 과목의 기간을 괄호 모양으로 묶어서 보여줘서 로테이션 흐름을 한눈에 알 수 있습니다.' },
      { id: 2, text: '날짜별 일정 & 메모 복기: 날짜를 누르면 그날 등록된 일정뿐만 아니라 과거 날짜에 썼던 메모들도 다시 볼 수 있습니다.' },
      { id: 3, text: '동적 일정 등록: 실습 과목을 시작할 때마다 기간에 맞춰 병원, 과목, 색상 바를 등록해 관리합니다.' },
    ]
  },
  portfolio: {
    title: '포트폴리오 (퀘스트 보드)',
    features: [
      { id: 1, text: '퀘스트 관리: 일일/주간/실습 누적으로 분류된 과제 체크리스트를 관리합니다.' },
      { id: 2, text: '마감일 설정 및 자동 알림: 과제별 마감일을 등록하면, 마감 2시간 전에 홈 화면에 알림 배너가 자동으로 뜹니다.' },
      { id: 3, text: '완료 처리: 완료한 과제는 터치 한 번으로 체크 표시를 해 남은 과제를 쉽게 파악할 수 있습니다.' },
      { id: 4, text: '디스카운팅 및 삭제: 실수로 여러 번 체크했더라도 목록을 꾹 누르면 카운트가 내려갑니다.\n카운트가 0이면 항목이 삭제됩니다.' },
    ]
  },
  timetable: {
    title: '시간표 공유',
    features: [
      { id: 1, text: '내 시간표 고정: 메인에 내 시간표 사진을 고정해서 탭 전환 없이 바로 확인할 수 있습니다.' },
      { id: 2, text: '동기 시간표 모아보기: 동기 이름을 입력하고 시간표 사진을 등록해 목록으로 관리하며, 언제든 전환해서 볼 수 있습니다.' },
      { id: 3, text: '사진 등록 및 크롭: 앨범에서 사진을 불러와 원하는 비율로 잘라서 저장할 수 있습니다.' },
    ]
  },
  memo: {
    title: '메모',
    features: [
      { id: 1, text: '날짜별 메모 등록: 매일 실습 중에 들은 교수님 피드백, 주요 학습 내용 등을 날짜별로 기록합니다.' },
      { id: 2, text: '메모 기반 통합 검색: 설정 탭의 검색 기능으로 메모에 썼던 모든 텍스트를 한꺼번에 찾아낼 수 있습니다.' },
    ]
  },
  meal: {
    title: '주간 식단',
    features: [
      { id: 1, text: '학식 사진 저장: 매주 찾아보기 힘든 주간 메뉴판 사진을 찍어 등록해 두고 매일 확인합니다.' },
      { id: 2, text: '텍스트 식단 등록: 사진이 없다면 직접 오늘 메뉴를 입력해서 보관할 수 있습니다.' },
    ]
  },
  settings: {
    title: '설정 & 자료실',
    features: [
      { id: 1, text: '통합 검색 (Quick find): 앱에 등록된 모든 일정, 메모, 포트폴리오 과제 속 글자를 한꺼번에 뒤져서 찾아냅니다.' },
      { id: 2, text: '자료실 (Data Box): 교수님 연락처, 병동 비밀번호 등 실습 중 필요한 중요 정보를 안전하게 보관합니다.' },
      { id: 3, text: '초기 세팅 변경: 사용자 이름과 캘린더 테마 색상을 언제든지 바꿀 수 있습니다.' },
    ]
  }
};

export default function TutorialModal({ visible, onClose }: any) {
  const [selectedTab, setSelectedTab] = useState<string | null>(null);

  const handleClose = () => {
    setSelectedTab(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.helpContent}>
          
          {selectedTab === null ? (
            // 💡 1. 탭 목록 화면
            <View style={{ flex: 1, width: '100%' }}>
              <View style={styles.mainHeader}>
                <Ionicons name="medical" size={32} color="#003594" style={{ marginBottom: 10 }} />
                <Text style={styles.greetingTitle}>스마트 비서 가이드</Text>
                <Text style={styles.greetingSub}>알고 싶은 기능을 선택하세요</Text>
              </View>
              
              <ScrollView showsVerticalScrollIndicator={false} style={styles.helpListScrollView}>
                {TAB_LIST.map((tab) => (
                  <TouchableOpacity key={tab.id} style={styles.listBtn} onPress={() => setSelectedTab(tab.id)}>
                    <Ionicons name={tab.icon as any} size={26} color="#003594" />
                    <Text style={styles.listText}>{tab.title}</Text>
                    <Ionicons name="chevron-forward" size={18} color="#CCC" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              <TouchableOpacity style={styles.finalCloseBtn} onPress={handleClose}>
                <Text style={styles.finalCloseText}>닫기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // 💡 2. 기능 설명 화면 (클릭 시 즉시 노출)
            <View style={{ flex: 1, width: '100%' }}>
              <View style={styles.detailHeader}>
                <TouchableOpacity onPress={() => setSelectedTab(null)} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={28} color="#333" />
                </TouchableOpacity>
                <Text style={styles.detailTitle}>{TUTORIAL_CONTENT[selectedTab].title}</Text>
                <View style={{ width: 28 }} /> 
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.featuresScrollView}>
                <View style={styles.featureListContainer}>
                  {TUTORIAL_CONTENT[selectedTab].features.map((item: any, index: number) => (
                    <View key={item.id} style={[styles.helpFeatureRow, index > 0 && styles.featureDivider]}>
                      <View style={styles.helpFeatureNumber}><Text style={styles.helpFeatureNumberText}>{item.id}</Text></View>
                      <Text style={styles.helpFeatureText}>{item.text}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              <TouchableOpacity style={styles.backToListBtn} onPress={() => setSelectedTab(null)}>
                <Text style={styles.backToListText}>목록으로 돌아가기</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  helpContent: { width: MODAL_WIDTH, height: '70%', backgroundColor: '#FFF', borderRadius: 30, padding: 25, elevation: 10, overflow: 'hidden' },
  
  // 메인 목록 스타일
  mainHeader: { alignItems: 'center', marginVertical: 15 },
  greetingTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 5 },
  greetingSub: { fontSize: 16, color: '#666' },
  helpListScrollView: { flex: 1, width: '100%', marginTop: 10 },
  listBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', paddingHorizontal: 5, gap: 15 },
  listText: { fontSize: 18, color: '#333' },
  finalCloseBtn: { marginTop: 20, paddingVertical: 15, backgroundColor: '#F2F5F8', borderRadius: 15, alignItems: 'center' },
  finalCloseText: { fontSize: 16, fontWeight: 'bold', color: '#555' },

  // 상세 설명 스타일
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  detailTitle: { fontSize: 22, fontWeight: 'bold', color: '#003594' },
  backBtn: { padding: 5 },
  featuresScrollView: { flex: 1 },
  featureListContainer: { paddingBottom: 20 },
  helpFeatureRow: { flexDirection: 'row', gap: 15, alignItems: 'flex-start' },
  featureDivider: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  helpFeatureNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#003594', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  helpFeatureNumberText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  helpFeatureText: { flex: 1, fontSize: 16, lineHeight: 26, color: '#444' },
  backToListBtn: { marginTop: 15, paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#EEE', alignItems: 'center' },
  backToListText: { color: '#003594', fontWeight: 'bold', fontSize: 16 }
});