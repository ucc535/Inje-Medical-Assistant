import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// 1. 브리핑(홈) 화면
function BriefingScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.headerTitle}>이번 주 브리핑</Text>
        <Text style={styles.subText}>다가오는 실습: 3/30 상계백병원 내과1</Text>
        <Text style={styles.alertText}>! 주말 제출 과제: 임상표현/술기 계획과 자기평가</Text>
      </View>
    </SafeAreaView>
  );
}

// 2. 시간표 화면
function TimetableScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>실습 시간표</Text>
      <Text style={styles.subText}>여기에 25조 시간표가 들어갈 예정입니다.</Text>
    </SafeAreaView>
  );
}

// 3. 체크리스트 화면
function ChecklistScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>제출 체크리스트</Text>
      <Text style={styles.subText}>U-포트폴리오 마감 관리가 들어갈 예정입니다.</Text>
    </SafeAreaView>
  );
}

// 4. 전체 메뉴 화면
function MenuScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>전체 메뉴</Text>
      <TouchableOpacity style={styles.menuItem}><Text>📅 캘린더</Text></TouchableOpacity>
      <TouchableOpacity style={styles.menuItem}><Text>📝 메모</Text></TouchableOpacity>
      <TouchableOpacity style={styles.menuItem}><Text>🍱 식단</Text></TouchableOpacity>
      <TouchableOpacity style={styles.menuItem}><Text>📁 파일 모음</Text></TouchableOpacity>
    </SafeAreaView>
  );
}

// 하단 탭 네비게이터 설정
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false, 
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === '브리핑') iconName = focused ? 'megaphone' : 'megaphone-outline';
          else if (route.name === '시간표') iconName = focused ? 'time' : 'time-outline';
          else if (route.name === '체크리스트') iconName = focused ? 'checkbox' : 'checkbox-outline';
          else if (route.name === '메뉴') iconName = focused ? 'menu' : 'menu-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2f95dc',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="브리핑" component={BriefingScreen} />
      <Tab.Screen name="시간표" component={TimetableScreen} />
      <Tab.Screen name="체크리스트" component={ChecklistScreen} />
      <Tab.Screen name="메뉴" component={MenuScreen} />
    </Tab.Navigator>
  );
}

// 앱 메인 엔트리
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={TabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// 기본 스타일 시트
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    marginTop: 20,
  },
  subText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  alertText: {
    fontSize: 16,
    color: '#d9534f',
    fontWeight: 'bold',
    marginTop: 10,
  },
  menuItem: {
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 10,
  }
});