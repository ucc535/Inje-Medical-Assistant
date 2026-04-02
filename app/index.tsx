import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function IntroScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // 화면 상태를 관리 (초기 로딩 'splash' -> 동의 화면 'consent')
  const [viewState, setViewState] = useState<'splash' | 'consent'>('splash');
  const [isAgreed, setIsAgreed] = useState(false);

  useEffect(() => {
    // 1. 페이드 인 애니메이션 시작 (기존 로직 유지)
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: true,
    }).start();

    // 2. 유저 데이터 확인 후 화면 전환 로직
    const checkUserAndNavigate = async () => {
      try {
        const consented = await AsyncStorage.getItem('user_consented');
        const userName = await AsyncStorage.getItem('user_name');

        // 3초 뒤에 결과에 따라 이동
        setTimeout(() => {
          if (consented === 'true') {
            if (userName) {
              router.replace('/(tabs)');
            } else {
              router.replace('/setup' as any);
            }
          } else {
            // 동의를 안 했으면 동의 화면으로 전환
            setViewState('consent');
          }
        }, 3000);
      } catch (e) {
        console.error("데이터 로딩 실패:", e);
        // 오류 시 안전하게 동의 화면으로 유도
        setTimeout(() => setViewState('consent'), 3000);
      }
    };

    checkUserAndNavigate();
  }, []);

  const handleConsentNext = async () => {
    if (!isAgreed) {
      Alert.alert('알림', '필수 약관에 동의하여야 시작할 수 있습니다.');
      return;
    }
    try {
      await AsyncStorage.setItem('user_consented', 'true');
      router.replace('/setup' as any); // 동의 완료 후 이름 설정으로 이동
    } catch (e) {
      Alert.alert('오류', '저장에 실패했습니다.');
    }
  };

  // 🌟 스플래시 화면 (기존 인트로 화면)
  if (viewState === 'splash') {
    return (
      <SafeAreaView style={styles.splashContainer}>
        <Animated.View style={[styles.splashContent, { opacity: fadeAnim }]}>
          {/* 상단 네이비 로고 */}
          <View style={styles.logoWrapper}>
            <Ionicons name="medical" size={80} color="#003594" />
          </View>

          {/* 학교 및 앱 이름 */}
          <Text style={styles.univText}>INJE UNIVERSITY</Text>
          <Text style={styles.collegeText}>College of Medicine</Text>
          <View style={styles.divider} />
          <Text style={styles.appName}>SMART ASSISTANT</Text>

          {/* 로딩 아이콘 영역 */}
          <View style={styles.loaderWrapper}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={styles.loaderText}>Initializing Clinical Environment...</Text>
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // 🛡️ 동의서 화면 (스플래시 통과 후 동의 안 한 유저에게만 표시)
  return (
    <SafeAreaView style={styles.consentContainer}>
      <View style={styles.consentHeader}>
        <Ionicons name="shield-checkmark" size={40} color="#003594" />
        <Text style={styles.consentTitle}>서비스 이용 동의</Text>
        <Text style={styles.consentSubTitle}>PK Note 시작을 위해 아래 약관 동의가 필요합니다.</Text>
      </View>

      <ScrollView style={styles.consentScroll} showsVerticalScrollIndicator={true}>
        <Text style={styles.consentTextBody}>
          <Text style={styles.boldText}>[제1조 목적]{'\n'}</Text>
          본 애플리케이션(이하 "앱")은 인제대학교 의과대학 임상실습생의 일정 관리, 과제 확인 및 학습 메모 기록을 지원하는 개인 학습 보조 도구입니다.{'\n\n'}

          <Text style={styles.boldText}>[제2조 데이터 저장 및 면책 조항]{'\n'}</Text>
          1. 본 앱은 사용자가 입력한 모든 데이터(이름, 일정, 메모, 첨부파일 등)를 외부 서버로 수집하거나 전송하지 않으며, 오직 사용자 기기의 내부 저장소(로컬)에만 저장합니다.{'\n'}
          2. 사용자의 부주의, 기기 분실, 또는 앱 삭제로 인하여 발생한 데이터의 영구 삭제 및 유실에 대한 모든 책임은 사용자 본인에게 있습니다.{'\n'}
          3. 앱의 기능 개선 및 버그 수정 등을 위한 업데이트 과정에서 예기치 않은 오류로 인하여 데이터가 유실될 수 있으며, 개발자는 이로 인한 데이터 손실에 대하여 어떠한 법적 책임도 지지 않습니다. 사용자는 중요한 데이터를 반드시 별도로 백업하여야 합니다.{'\n\n'}

          <Text style={styles.boldText}>[제3조 환자 개인정보 보호 의무]{'\n'}</Text>
          1. 사용자는 임상실습 중 취득한 환자의 민감한 개인정보(성명, 주민등록번호, 병원 등록번호, 상세 병력 등)를 본 앱에 절대 직접 입력하여서는 안 됩니다.{'\n'}
          2. 증례 발표 준비 및 학습용 메모 작성 시, 반드시 환자를 식별할 수 없는 형태(예: 환자 A, 60세/남)로 철저히 비식별화하여 기록하여야 합니다.{'\n'}
          3. 본 조항을 위반하여 환자 개인정보 유출 등의 사고가 발생할 경우, 이에 대한 모든 민·형사상 및 학칙에 따른 법적 책임은 전적으로 사용자 본인에게 있습니다.{'\n\n'}

          <Text style={styles.boldText}>[제4조 실습 병원 보안 지침 준수]{'\n'}</Text>
          사용자는 본 앱을 이용함에 있어 배정된 실습 병원의 보안 지침 및 규정을 최우선으로 준수하여야 하며, 통제 구역 내에서의 무단 촬영, 녹음 등 병원 규정에 위배되는 행위를 하여서는 안 됩니다.{'\n\n'}

          <Text style={styles.boldText}>[제5조 효력 제한]{'\n'}</Text>
          본 앱은 공식적인 전자의무기록(EMR) 시스템이나 학교의 공식 평가 시스템을 대체할 수 없으며, 앱에 입력된 데이터의 정확성, 무결성 및 적법성에 대하여 개발자는 어떠한 보증도 하지 않습니다.
        </Text>
      </ScrollView>

      <View style={styles.consentFooter}>
        <TouchableOpacity 
          style={styles.checkboxRow} 
          onPress={() => setIsAgreed(!isAgreed)}
        >
          <Ionicons 
            name={isAgreed ? "checkbox" : "square-outline"} 
            size={26} 
            color={isAgreed ? "#003594" : "#CCC"} 
          />
          <Text style={styles.checkboxLabel}>본인은 위 이용약관 및 면책조항을 모두 숙지하였으며, 이에 동의합니다. (필수)</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.nextBtn, !isAgreed && styles.disabledBtn]} 
          onPress={handleConsentNext}
        >
          <Text style={styles.nextBtnText}>동의하고 시작하기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // --- 스플래시 화면 스타일 ---
  splashContainer: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  splashContent: { alignItems: 'center', width: '100%' },
  logoWrapper: { marginBottom: 20 },
  univText: { fontSize: 16, color: '#003594', letterSpacing: 3, fontWeight: '600' },
  collegeText: { fontSize: 22, fontWeight: 'bold', color: '#333', marginTop: 5 },
  divider: { width: 30, height: 2, backgroundColor: '#4A90E2', marginVertical: 20 },
  appName: { fontSize: 14, color: '#999', letterSpacing: 5 },
  loaderWrapper: { marginTop: 60, alignItems: 'center', gap: 15 },
  loaderText: { fontSize: 12, color: '#BBB', fontStyle: 'italic' },

  // --- 동의서 화면 스타일 ---
  consentContainer: { flex: 1, backgroundColor: '#FFF' },
  consentHeader: { padding: 30, alignItems: 'center', backgroundColor: '#F8F9FA' },
  consentTitle: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', marginTop: 15 },
  consentSubTitle: { fontSize: 13, color: '#666', marginTop: 5, textAlign: 'center' },
  consentScroll: { flex: 1, padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  consentTextBody: { fontSize: 14, color: '#333', lineHeight: 24 },
  boldText: { fontWeight: 'bold', color: '#003594', fontSize: 15 },
  consentFooter: { padding: 20, paddingBottom: 40 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10, paddingRight: 10 },
  checkboxLabel: { fontSize: 14, color: '#1A1A1A', fontWeight: '600', flex: 1, lineHeight: 20 },
  nextBtn: { backgroundColor: '#003594', paddingVertical: 16, borderRadius: 15, alignItems: 'center' },
  disabledBtn: { backgroundColor: '#CCC' },
  nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});