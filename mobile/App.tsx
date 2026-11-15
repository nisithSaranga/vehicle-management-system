import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { AppConfig, VehicleRecord } from '@vehicle-management/shared';
import { supabase, type Profile } from './src/lib/supabase';

const config: AppConfig = { appName: 'Riyon International Pvt Ltd', version: '0.1.0' };
const logo = require('./assets/riyon-logo.png');
type Section = 'fleet' | 'operations' | 'compliance' | 'maintenance' | 'fuel' | 'reports';
type RecordRow = Record<string, unknown> & { id: string; vehicle_id: string };
const colors = { red: '#b42318', navy: '#102a43', muted: '#52606d', border: '#d9e2ec' };
const VEHICLE_TYPES = [
  'Double Cab',
  'Electric Car',
  'Excavator',
  'Forklift',
  'Light Truck',
  'Lorry',
  'Motor Bike',
  'Single Cab',
];
const DEPARTMENTS = ['Administration', 'Finance', 'Logistics', 'Maintenance', 'Operations', 'Production'];
const VEHICLE_MAKES = ['Bajaj', 'Baw', 'BYD', 'Honda', 'Komatsu', 'Mitsubishi', 'Tata', 'Yamaha'];
const USUAL_USERS = ['Asfer', 'Gunathunga', 'Mahinda', 'Ms. Fiona', 'Nisith', 'Ramesh', 'W.U. Kumara'];
async function normalizeImage(uri: string) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

async function choosePhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission required', 'Allow photo access to attach a certificate or receipt.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.9,
  });
  return result.canceled ? null : result.assets[0]?.uri ?? null;
}
async function choosePhotos(): Promise<string[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission required', 'Allow photo access to attach vehicle photos.');
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    allowsEditing: false,
    quality: 0.9,
  });
  return result.canceled ? [] : result.assets.map((asset) => asset.uri);
}
function isMissingSchemaField(message: string) {
  return /does not exist|could not find|schema cache|column .* missing/i.test(message);
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [section, setSection] = useState<Section | null>(null);
  const [selected, setSelected] = useState<VehicleRecord | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [search, setSearch] = useState('');
  const dark = theme === 'dark';
  const palette = useMemo(
    () => ({
      bg: dark ? '#111827' : '#f5f7fb',
      card: dark ? '#1f2937' : '#fff',
      text: dark ? '#f3f4f6' : colors.navy,
      muted: dark ? '#cbd5e1' : colors.muted,
    }),
    [dark],
  );
  const canManage = profile?.role === 'administrator';

  const refresh = async () => {
    const { data, error: queryError } = await supabase
      .from('vehicles')
      .select(
        'id, registration_number, make, model, vehicle_type, manufacturing_year, department, assigned_driver, energy_type, fuel_type, status',
      )
      .order('registration_number');
    if (queryError) setError(queryError.message);
    else setVehicles((data ?? []) as VehicleRecord[]);
  };
  useEffect(() => {
    const loadProfile = async (id: string) => {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', id)
        .single();
      if (profileError) setError('Your account does not have a Riyon International profile yet.');
      else setProfile(data as Profile);
    };
    const load = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) setError(sessionError.message);
      if (data.session) {
        setSession(data.session);
        await loadProfile(data.session.user.id);
        await refresh();
      }
      setLoading(false);
    };
    const { data } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      if (next) {
        await loadProfile(next.user.id);
        await refresh();
      } else {
        setProfile(null);
        setVehicles([]);
      }
    });
    void load();
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading)
    return (
      <Centered palette={palette}>
        <Text style={{ color: palette.text }}>Loading Riyon International...</Text>
      </Centered>
    );
  if (!session || !profile) return <Login error={error} onError={setError} palette={palette} />;
  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.dashboardTopbar}>
          <Image source={logo} style={styles.dashboardLogo} resizeMode="contain" />
          <View style={styles.topbarActions}>
            <Text style={[styles.roleBadge, { color: palette.text }]}>{profile.role}</Text>
            <Pressable
              style={styles.themeToggle}
              onPress={() => setTheme(dark ? 'light' : 'dark')}
              accessibilityLabel={`Switch to ${dark ? 'light' : 'dark'} mode`}
            >
              <Text style={[styles.themeSymbol, { color: palette.text }]}>{dark ? '☼' : '☾'}</Text>
            </Pressable>
          </View>
        </View>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search vehicles, compliance, maintenance..."
          placeholderTextColor="#829ab1"
          style={[styles.searchInput, { backgroundColor: palette.card, color: palette.text }]}
        />
        <View style={styles.welcomeBlock}>
          <Text style={[styles.welcomeTitle, { color: palette.text }]}>
             Welcome, {profile.email?.split('@')[0]}!
          </Text> 
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Here&apos;s your fleet overview for today.
          </Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.statGrid}>
          <StatCard label="Total vehicles" value={vehicles.length} icon="🚘" tone="blue" palette={palette} />
          <StatCard
            label="Active fleet"
            value={vehicles.filter((vehicle) => vehicle.status === 'active').length}
            icon="✓"
            tone="green"
            palette={palette}
          />
          <StatCard
            label="Archived"
            value={vehicles.filter((vehicle) => vehicle.status !== 'active').length}
            icon="!"
            tone="orange"
            palette={palette}
          />
        </View>
        <View style={[styles.complianceCard, { backgroundColor: colors.navy }]}>
          <View style={styles.complianceHeader}>
            <Text style={styles.complianceIcon}>✓</Text>
            <Text style={styles.complianceTitle}>Fleet overview</Text>
            <Text style={styles.complianceLink}>Riyon</Text>
          </View>
          <Text style={styles.complianceDescription}>
            Keep vehicles, inspections, compliance, and maintenance in one place.
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${vehicles.length ? Math.round((vehicles.filter((v) => v.status === 'active').length / vehicles.length) * 100) : 0}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {vehicles.length
              ? `${Math.round((vehicles.filter((v) => v.status === 'active').length / vehicles.length) * 100)}% of your fleet is active`
              : 'Add your first vehicle to start tracking'}
          </Text>
        </View>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Fleet management</Text>
          <Text style={[styles.sectionHint, { color: palette.muted }]}>Quick access</Text>
        </View>
        <View style={styles.tiles}>
          {(
            [
              ['fleet', 'Vehicles', 'Register, archive, restore', '🚘'],
              ['operations', 'Inspections', 'Mileage and weekly checks', '✓'],
              ['compliance', 'Compliance', 'Licences, tests, insurance', '▣'],
              ['maintenance', 'Maintenance', 'Service and repair history', '⚒'],
              ['fuel', 'Fuel & Refuelling', 'Track fuel usage and costs', '⛽'],
              ['reports', 'Reports', 'Structured vehicle report', '▥'],
            ] as Array<[Section, string, string, string]>
          )
            .filter(([, title, description]) =>
              `${title} ${description}`.toLowerCase().includes(search.toLowerCase()),
            )
            .map(([id, title, description, icon], index) => (
            <Pressable
              key={id}
              style={[styles.tile, { backgroundColor: palette.card }]}
              onPress={() => setSection(id)}
            >
              <View style={styles.tileTopline}>
                <Text style={styles.tileIcon}>{icon}</Text>
                <Text style={styles.tileNumber}>{String(index + 1).padStart(2, '0')}</Text>
              </View>
              <Text style={[styles.tileTitle, { color: palette.text }]}>{title}</Text>
              <Text style={[styles.tileText, { color: palette.muted }]}>{description}</Text>
              <Text style={styles.tileArrow}>View details  →</Text>
            </Pressable>
            ))}
        </View>
        <Pressable style={styles.signOut} onPress={() => void supabase.auth.signOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
        <Text style={[styles.footer, { color: palette.muted }]}>Version {config.version}</Text>
      </ScrollView>
      <Modal
        visible={section !== null}
        animationType="slide"
        onRequestClose={() => setSection(null)}
      >
        <View style={[styles.modalPage, { backgroundColor: palette.bg }]}>
          {section === 'fleet' && (
            <Fleet
              vehicles={vehicles}
              canManage={!!canManage}
              userId={session.user.id}
              onRefresh={refresh}
              onSelect={setSelected}
              palette={palette}
            />
          )}
          {section === 'operations' && (
            <Operations
              vehicles={vehicles}
              canManage={!!canManage}
              userId={session.user.id}
              palette={palette}
            />
          )}
          {section === 'compliance' && (
            <Compliance
              vehicles={vehicles}
              canManage={!!canManage}
              palette={palette}
            />
          )}
          {section === 'maintenance' && (
            <Maintenance
              vehicles={vehicles}
              canManage={!!canManage}
              userId={session.user.id}
              palette={palette}
            />
          )}
          {section === 'fuel' && (
            <Fuel
              vehicles={vehicles}
              canManage={!!canManage}
              userId={session.user.id}
              palette={palette}
            />
          )}
          {section === 'reports' && <Reports vehicles={vehicles} palette={palette} />}
        </View>
      </Modal>
      <VehicleProfile
        vehicle={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        onToggleArchive={async () => {
          if (!selected) return;
          const { error: archiveError } = await supabase
            .from('vehicles')
            .update({ status: selected.status === 'active' ? 'archived' : 'active' })
            .eq('id', selected.id);
          if (archiveError) {
            Alert.alert('Unable to update vehicle status', archiveError.message);
            return;
          }
          await refresh();
          setSelected(null);
        }}
        canManage={!!canManage}
        userId={session.user.id}
        palette={palette}
      />
      <StatusBar style={dark ? 'light' : 'dark'} />
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
  palette,
}: {
  label: string;
  value: number;
  icon: string;
  tone: 'blue' | 'green' | 'orange';
  palette: { bg: string; card: string; text: string; muted: string };
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: palette.card }]}>
      <View
        style={[
          styles.statIcon,
          {
            backgroundColor: { blue: '#e1efff', green: '#d9f7e7', orange: '#fff0d4' }[tone],
          },
        ]}
      >
        <Text style={styles.statIconText}>{icon}</Text>
      </View>
      <Text style={[styles.statLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

function sectionTitle(section: Section | null) {
  return {
    fleet: 'Vehicles',
    operations: 'Weekly records',
    compliance: 'Compliance',
    maintenance: 'Maintenance',
    fuel: 'Fuel & Refuelling',
    reports: 'Reports',
  }[section ?? 'fleet'];
}
function vehicleIcon(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes('bike') || normalized.includes('scooty')) return '🏍';
  if (normalized.includes('forklift')) return '🏗';
  if (normalized.includes('light truck')) return '🛻';
  if (normalized.includes('lorry') || normalized.includes('cab')) return '🚚';
  return '🚘';
}
function Centered({ children, palette }: { children: ReactNode; palette: { bg: string } }) {
  return <View style={[styles.centered, { backgroundColor: palette.bg }]}>{children}</View>;
}
function Login({
  error,
  onError,
  palette,
}: {
  error: string;
  onError: (v: string) => void;
  palette: { bg: string; card: string; text: string; muted: string };
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    onError('');
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    if (e) onError(e.message);
    setBusy(false);
  };
  return (
    <Centered palette={palette}>
      <Image source={logo} style={styles.logo} resizeMode="contain" />
      <Text style={[styles.eyebrow, { color: palette.muted }]}>VEHICLE MANAGEMENT</Text>
      <Text style={[styles.title, { color: palette.text }]}>{config.appName}</Text>
      <Text style={[styles.subtitle, { color: palette.muted }]}>Vehicle Management System</Text>
      <View style={[styles.loginCard, { backgroundColor: palette.card }]}>
        <Field label="Email" value={email} onChange={setEmail} palette={palette} />
        <Field label="Password" value={password} onChange={setPassword} secure palette={palette} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title={busy ? 'Signing in...' : 'Sign in'} onPress={() => void submit()} />
      </View>
      <StatusBar style="auto" />
    </Centered>
  );
}
function Field({
  label,
  value,
  onChange,
  palette,
  secure = false,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  palette: { text: string; card: string };
  secure?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
}) {
  return (
    <TextInput
      placeholder={label}
      placeholderTextColor="#829ab1"
      autoCapitalize="none"
      secureTextEntry={secure}
      keyboardType={keyboardType}
      style={[styles.input, { color: palette.text, borderColor: colors.border }]}
      value={value}
      onChangeText={onChange}
    />
  );
}
function DatePickerField({
  label,
  value,
  onChange,
  palette,
  allowFuture = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  palette: { card: string; text: string; muted: string };
  allowFuture?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: palette.muted }]}>{label}</Text>
      <Pressable
        style={[styles.dateButton, { backgroundColor: palette.card, borderColor: colors.border }]}
        onPress={() => setOpen(true)}
      >
        <Text style={{ color: value ? palette.text : palette.muted }}>
          {value || 'Select date'}
        </Text>
        <Text style={{ color: palette.muted }}>▣</Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={parseDate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={allowFuture ? undefined : new Date()}
          onChange={(_event, selectedDate) => {
            setOpen(false);
            if (selectedDate) onChange(formatDate(selectedDate));
          }}
        />
      )}
    </View>
  );
}
function parseDate(value: string) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, (month || 1) - 1, day || 1);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
function formatDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function Button({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'archive';
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'success' && styles.buttonSuccess,
        variant === 'archive' && styles.buttonArchive,
        disabled && { opacity: 0.6 },
      ]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}
function Panel({ children }: { children: ReactNode }) {
  return <ScrollView contentContainerStyle={styles.panel}>{children}</ScrollView>;
}
function Heading({ children, palette }: { children: string; palette: { text: string } }) {
  return <Text style={[styles.heading, { color: palette.text }]}>{children}</Text>;
}
function VehiclePicker({
  vehicles,
  value,
  onChange,
  palette,
}: {
  vehicles: VehicleRecord[];
  value: string;
  onChange: (v: string) => void;
  palette: { card: string; text: string; muted: string };
}) {
  return (
    <View style={styles.pickerWrap}>
      {vehicles.map((v) => (
        <Pressable
          key={v.id}
          onPress={() => onChange(v.id)}
          style={[styles.picker, { backgroundColor: value === v.id ? colors.red : palette.card }]}
        >
          <Text style={{ color: value === v.id ? '#fff' : palette.text }}>
            {v.registration_number}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function Fleet({
  vehicles,
  canManage,
  userId,
  onRefresh,
  onSelect,
  palette,
}: {
  vehicles: VehicleRecord[];
  canManage: boolean;
  userId: string;
  onRefresh: () => Promise<void>;
  onSelect: (v: VehicleRecord) => void;
  palette: { bg: string; card: string; text: string; muted: string };
}) {
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('All types');
  const [departmentFilter, setDepartmentFilter] = useState('All departments');
  const [attention, setAttention] = useState<Record<string, { message: string; tone: 'attention' | 'due' | 'active' }>>({});
  useEffect(() => {
    const loadAttention = async () => {
      const [{ data: compliance, error: complianceError }, { data: maintenance, error: maintenanceError }] =
        await Promise.all([
          supabase
            .from('compliance_records')
            .select('vehicle_id, compliance_type, expiry_date, updated_at, created_at'),
          supabase.from('maintenance_records').select('vehicle_id, next_service_date'),
        ]);
      if (complianceError || maintenanceError) {
        Alert.alert(
          'Unable to load vehicle due dates',
          complianceError?.message ?? maintenanceError?.message ?? 'Please try again.',
        );
        return;
      }
      const today = new Date();
      const todayText = formatDate(today);
      const nextState: Record<string, { message: string; tone: 'attention' | 'due' | 'active' }> = {};
      for (const vehicle of vehicles) {
        const vehicleMaintenance = (maintenance ?? [])
          .filter((record) => record.vehicle_id === vehicle.id && record.next_service_date)
          .sort((a, b) => String(a.next_service_date).localeCompare(String(b.next_service_date)));
        const nextService = vehicleMaintenance[0]?.next_service_date as string | undefined;
        const latestComplianceByType = new Map<string, { expiry_date: string }>();
        for (const record of (compliance ?? [])
          .filter((item) => item.vehicle_id === vehicle.id && item.expiry_date)
          .sort((a, b) =>
            String(b.updated_at ?? b.created_at ?? '').localeCompare(
              String(a.updated_at ?? a.created_at ?? ''),
            ),
          )) {
          if (!latestComplianceByType.has(String(record.compliance_type))) {
            latestComplianceByType.set(String(record.compliance_type), {
              expiry_date: String(record.expiry_date),
            });
          }
        }
        const complianceDueCandidates = Array.from(latestComplianceByType.entries()).map(
          ([complianceType, record]) => ({
            date: record.expiry_date,
            label:
              complianceType === 'Revenue Licence'
                ? 'Revenue licence expires'
                : complianceType === 'Emission Test'
                  ? 'Emission test expires'
                  : 'Insurance expires',
          }),
        );
        const dueCandidates = [
          nextService ? { date: nextService, label: 'Next service' } : null,
          ...complianceDueCandidates,
        ]
          .filter((candidate): candidate is { date: string; label: string } => candidate !== null)
          .sort((a, b) => a.date.localeCompare(b.date));
        const nextDue = dueCandidates[0];
        if (!nextDue) {
          nextState[vehicle.id] = { message: 'No upcoming due date', tone: 'active' };
          continue;
        }
        const dueDate = nextDue.date;
        const days = Math.ceil(
          (new Date(`${dueDate}T00:00:00`).getTime() - new Date(`${todayText}T00:00:00`).getTime()) /
            86400000,
        );
        const label = nextDue.label;
        nextState[vehicle.id] =
          days < 0
            ? { message: `${label} overdue by ${Math.abs(days)} days`, tone: 'attention' }
            : days <= 30
              ? { message: `${label} in ${days} days`, tone: 'due' }
              : { message: `${label} ${dueDate}`, tone: 'active' };
      }
      setAttention(nextState);
    };
    if (vehicles.length) void loadAttention();
  }, [vehicles]);
  const visibleVehicles = vehicles
    .filter((v) => (showArchived ? v.status !== 'active' : v.status === 'active'))
    .filter((v) => `${v.make} ${v.model} ${v.registration_number}`.toLowerCase().includes(searchText.toLowerCase()))
    .filter((v) => typeFilter === 'All types' || v.vehicle_type === typeFilter)
    .filter((v) => departmentFilter === 'All departments' || v.department === departmentFilter);
  const vehicleTypes = ['All types', ...VEHICLE_TYPES];
  const departments = ['All departments', ...DEPARTMENTS];
  const needsAction = vehicles.filter((v) => attention[v.id]?.tone !== 'active').length;
  return (
    <Panel>
      <View style={styles.fleetHeader}>
        <View>
          <Heading palette={palette}>Vehicles</Heading>
          <Text style={{ color: palette.muted }}>
            {vehicles.length} vehicles · {needsAction} need action
          </Text>
        </View>
        {canManage && (
          <Button
            title="+ Add vehicle"
            variant="secondary"
            onPress={() => setShowForm(!showForm)}
          />
        )}
      </View>
      {!showForm && (
        <>
          <View style={styles.listToggle}>
            <Pressable
              style={[styles.listToggleButton, !showArchived && styles.listToggleActive]}
              onPress={() => setShowArchived(false)}
            >
              <Text style={{ color: !showArchived ? '#fff' : palette.muted }}>
                Active · {vehicles.filter((v) => v.status === 'active').length}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.listToggleButton, showArchived && styles.listToggleActive]}
              onPress={() => setShowArchived(true)}
            >
              <Text style={{ color: showArchived ? '#fff' : palette.muted }}>Archived</Text>
            </Pressable>
          </View>
          <Field
            label="Search name or plate"
            value={searchText}
            onChange={setSearchText}
            palette={palette}
          />
          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <ChoiceField
                label="Type"
                value={typeFilter}
                options={vehicleTypes}
                onChange={setTypeFilter}
                palette={palette}
              />
            </View>
            <View style={styles.filterField}>
              <ChoiceField
                label="Department"
                value={departmentFilter}
                options={departments}
                onChange={setDepartmentFilter}
                palette={palette}
              />
            </View>
          </View>
        </>
      )}
      {showForm && (
        <VehicleForm
          onSaved={() => {
            setShowForm(false);
            void onRefresh();
          }}
          userId={userId}
          palette={palette}
        />
      )}
      {!showForm && (visibleVehicles.length === 0 ? (
        <Text style={{ color: palette.muted }}>
          {showArchived ? 'No archived vehicles.' : 'No active vehicles have been registered yet.'}
        </Text>
      ) : (
        visibleVehicles.map((v) => (
          <Pressable
            key={v.id}
            style={[styles.card, { backgroundColor: palette.card }]}
            onPress={() => onSelect(v)}
          >
            <View style={styles.vehicleListHeader}>
              <Text style={styles.vehicleTypeIcon}>{vehicleIcon(v.vehicle_type)}</Text>
              <View style={styles.vehicleListCopy}>
                <View style={styles.vehicleCardTitleRow}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>{v.make} {v.model}</Text>
                  <Text
                    style={[
                      styles.vehicleStatus,
                      attention[v.id]?.tone === 'attention'
                        ? styles.vehicleStatusAttention
                        : attention[v.id]?.tone === 'due'
                          ? styles.vehicleStatusDue
                          : styles.vehicleStatusActive,
                    ]}
                  >
                    {attention[v.id]?.tone === 'attention'
                      ? 'Needs attention'
                      : attention[v.id]?.tone === 'due'
                        ? 'Due soon'
                        : v.status === 'active'
                          ? 'Active'
                          : 'Archived'}
                  </Text>
                </View>
                <Text style={styles.plate}>{v.registration_number}</Text>
                <Text style={{ color: palette.muted }}>
                  {v.vehicle_type} · {v.department ?? 'No department'} ·{' '}
                  {v.energy_type === 'electric' ? 'Electric' : v.fuel_type ?? 'Fuel'}
                </Text>
              </View>
            </View>
            <View style={styles.vehicleDueRow}>
              <Text style={{ color: attention[v.id]?.tone === 'attention' ? colors.red : palette.muted }}>
                {attention[v.id]?.message ?? 'No upcoming due date'}
              </Text>
            </View>
          </Pressable>
        ))
      ))}
    </Panel>
  );
}

function ChoiceField({
  label,
  value,
  options,
  onChange,
  palette,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  palette: { card: string; text: string; muted: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.dropdownWrap}>
      <Text style={[styles.fieldLabel, { color: palette.muted }]}>{label}</Text>
      <Pressable
        style={[styles.dropdownButton, { backgroundColor: palette.card }]}
        onPress={() => setOpen(!open)}
      >
        <Text style={{ color: value ? palette.text : palette.muted }}>
          {value || `Select ${label.toLowerCase()}`}
        </Text>
        <Text style={{ color: palette.muted }}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open && (
        <View style={[styles.dropdownList, { backgroundColor: palette.card }]}>
          {options.map((option) => (
            <Pressable
              key={option}
              style={styles.dropdownOption}
              onPress={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              <Text style={{ color: palette.text }}>{option}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function VehicleForm({
  onSaved,
  userId,
  palette,
}: {
  onSaved: () => void;
  userId: string;
  palette: { text: string; card: string; muted: string };
}) {
  const [form, setForm] = useState({
    registration_number: '',
    make: '',
    model: '',
    vehicle_type: '',
    manufacturing_year: String(new Date().getFullYear()),
    department: '',
    assigned_driver: '',
    energy_type: 'fuel',
    fuel_type: '',
  });
  const [busy, setBusy] = useState(false);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const save = async () => {
    if (
      !form.registration_number ||
      !form.make ||
      !form.model ||
      !form.vehicle_type ||
      !form.energy_type ||
      (form.energy_type === 'fuel' && !form.fuel_type)
    )
      return Alert.alert(
        'Required',
        'Registration, make, model, vehicle type, energy type, and fuel type for fuel vehicles are required.',
      );
    setBusy(true);
    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .insert({ ...form, manufacturing_year: Number(form.manufacturing_year) })
      .select('id')
      .single();
    if (error) {
      Alert.alert('Unable to add vehicle', error.message);
      setBusy(false);
      return;
    }
    if (photoUris.length && vehicle?.id) {
      try {
        for (const [index, uri] of photoUris.entries()) {
          const filePath = `${vehicle.id}/vehicle-${Date.now()}-${index}-${uri.split('/').pop() ?? 'photo'}`;
          const normalizedUri = await normalizeImage(uri);
          const file = await new FileSystem.File(normalizedUri).bytes();
          const { error: uploadError } = await supabase.storage
            .from('vehicle-documents')
            .upload(filePath, file, { upsert: false, contentType: 'image/jpeg' });
          if (uploadError) throw uploadError;
          const { error: documentError } = await supabase.from('vehicle_documents').insert({
            vehicle_id: vehicle.id,
            document_type: 'Vehicle Photo',
            file_path: filePath,
            uploaded_by: userId,
          });
          if (documentError) throw documentError;
        }
      } catch (photoError) {
        Alert.alert(
          'Vehicle saved, but photos could not be uploaded',
          photoError instanceof Error ? photoError.message : 'Please add photos from the vehicle profile.',
        );
      }
    }
    onSaved();
    setBusy(false);
  };
  return (
    <View style={[styles.form, { backgroundColor: palette.card }]}>
      <Field
        label="Registration Number"
        value={form.registration_number}
        onChange={set('registration_number')}
        palette={palette}
      />
      <ChoiceField
        label="Make"
        value={form.make}
        options={VEHICLE_MAKES}
        onChange={set('make')}
        palette={palette}
      />
      <Field label="Model" value={form.model} onChange={set('model')} palette={palette} />
      <Field
        label="Manufacturing year"
        value={form.manufacturing_year}
        onChange={set('manufacturing_year')}
        palette={palette}
      />
      <ChoiceField
        label="Vehicle type"
        value={form.vehicle_type}
        options={VEHICLE_TYPES}
        onChange={set('vehicle_type')}
        palette={palette}
      />
      <ChoiceField
        label="Department"
        value={form.department}
        options={DEPARTMENTS}
        onChange={set('department')}
        palette={palette}
      />
      <ChoiceField
        label="Usual company user"
        value={form.assigned_driver}
        options={USUAL_USERS}
        onChange={set('assigned_driver')}
        palette={palette}
      />
      <ChoiceField
        label="Energy type"
        value={form.energy_type === 'fuel' ? 'Fuel' : 'Electric'}
        options={['Fuel', 'Electric']}
        onChange={(option) =>
          setForm((current) => ({
            ...current,
            energy_type: option === 'Fuel' ? 'fuel' : 'electric',
            fuel_type: option === 'Fuel' ? current.fuel_type : '',
          }))
        }
        palette={palette}
      />
      {form.energy_type === 'fuel' && (
        <ChoiceField
          label="Fuel type"
          value={form.fuel_type}
          options={['Petrol', 'Diesel']}
          onChange={set('fuel_type')}
          palette={palette}
        />
      )}
      <Pressable
        style={styles.attachmentBox}
        onPress={() => void choosePhotos().then(setPhotoUris)}
      >
        {photoUris.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {photoUris.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.attachmentPreview} />
            ))}
          </ScrollView>
        ) : (
          <Text style={{ color: palette.muted }}>Upload vehicle photos</Text>
        )}
      </Pressable>
      <Button
        title={busy ? 'Saving...' : 'Save vehicle'}
        disabled={busy}
        onPress={() => void save()}
      />
    </View>
  );
}

function Operations({
  vehicles,
  canManage,
  userId,
  palette,
}: {
  vehicles: VehicleRecord[];
  canManage: boolean;
  userId: string;
  palette: { bg: string; card: string; text: string; muted: string };
}) {
  const [vehicleId, setVehicleId] = useState('');
  const [mode, setMode] = useState<'mileage' | 'inspection' | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [odometer, setOdometer] = useState('');
  const [inspectionOdometer, setInspectionOdometer] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [condition, setCondition] = useState('Good');
  const [mileageRemarks, setMileageRemarks] = useState('');
  const [inspectionRemarks, setInspectionRemarks] = useState('');
  const [mileageRows, setMileageRows] = useState<RecordRow[]>([]);
  const [inspectionRows, setInspectionRows] = useState<RecordRow[]>([]);
  const [historyView, setHistoryView] = useState<'mileage' | 'inspection' | null>(null);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const loadHistory = async () => {
    if (!vehicleId) {
      setMileageRows([]);
      setInspectionRows([]);
      return;
    }
    const [mileage, inspections] = await Promise.all([
      supabase
        .from('mileage_records')
        .select('id, vehicle_id, odometer_reading, reading_date, notes')
        .eq('vehicle_id', vehicleId)
        .order('reading_date', { ascending: false })
        .limit(5),
      supabase
        .from('inspections')
        .select('id, vehicle_id, inspection_date, odometer_reading, overall_condition, remarks')
        .eq('vehicle_id', vehicleId)
        .order('inspection_date', { ascending: false })
        .limit(5),
    ]);
    if (mileage.error || inspections.error) {
      Alert.alert(
        'Unable to load records',
        mileage.error?.message ?? inspections.error?.message ?? 'Please try again.',
      );
      return;
    }
    setMileageRows((mileage.data ?? []) as RecordRow[]);
    setInspectionRows((inspections.data ?? []) as RecordRow[]);
  };
  useEffect(() => {
    void loadHistory();
  }, [vehicleId]);
  const saveMileage = async () => {
    if (!canManage) return;
    const reading = Number.parseFloat(odometer);
    if (!vehicleId || !date || date > formatDate(new Date()) || !Number.isFinite(reading) || reading < 0) {
      Alert.alert('Required', 'Select a vehicle, enter a valid odometer reading, and choose a date.');
      return;
    }
    const { data: existing, error: existingError } = await supabase
      .from('mileage_records')
      .select('id')
      .eq('vehicle_id', vehicleId)
      .eq('reading_date', date)
      .limit(1);
    if (existingError) {
      Alert.alert('Unable to check mileage records', existingError.message);
      return;
    }
    if (existing?.length) {
      Alert.alert('Mileage already recorded', 'Only one mileage record can be saved for this vehicle on a day.');
      return;
    }
    const { error } = await supabase.from('mileage_records').insert({
      vehicle_id: vehicleId,
      recorded_by: userId,
      odometer_reading: reading,
      reading_date: date,
      notes: mileageRemarks,
    });
    if (error) Alert.alert('Unable to save mileage', error.message);
    else {
      setOdometer('');
      setMileageRemarks('');
      await loadHistory();
      Alert.alert('Saved', 'Mileage reading added.');
    }
  };
  const saveInspection = async () => {
    if (!canManage) return;
    const reading = Number.parseFloat(inspectionOdometer);
    if (
      !vehicleId ||
      !date ||
      date > formatDate(new Date()) ||
      !condition ||
      !Number.isFinite(reading) ||
      reading < 0
    ) {
      Alert.alert(
        'Required',
        'Select a vehicle, choose a date, enter the odometer reading, and enter the condition.',
      );
      return;
    }
    const { error } = await supabase.from('inspections').insert({
      vehicle_id: vehicleId,
      inspector_id: userId,
      inspection_date: date,
      week_start_date: date,
      odometer_reading: reading,
      overall_condition: condition,
      remarks: inspectionRemarks,
    });
    if (error) Alert.alert('Unable to save inspection', error.message);
    else {
      setInspectionOdometer('');
      setInspectionRemarks('');
      await loadHistory();
      Alert.alert('Saved', 'Inspection recorded.');
    }
  };
  return (
    <Panel>
      <View style={styles.operationsIntro}>
        <Heading palette={palette}>Vehicle updates</Heading>
        <Text style={{ color: palette.muted }}>
          Choose a vehicle first, then select the record you want to add.
        </Text>
      </View>
      {!canManage && <Text style={{ color: palette.muted }}>Management access is read-only.</Text>}
      <View style={styles.dropdownWrap}>
        <Text style={[styles.fieldLabel, { color: palette.muted }]}>Vehicle</Text>
        <Pressable
          style={[styles.dropdownButton, { backgroundColor: palette.card }]}
          onPress={() => setDropdownOpen(!dropdownOpen)}
        >
          <Text style={{ color: selectedVehicle ? palette.text : palette.muted }}>
            {selectedVehicle
              ? `${vehicleIcon(selectedVehicle.vehicle_type)}  ${selectedVehicle.make} ${selectedVehicle.model} · ${selectedVehicle.registration_number}`
              : 'Select a registered vehicle'}
          </Text>
          <Text style={{ color: palette.muted }}>{dropdownOpen ? '⌃' : '⌄'}</Text>
        </Pressable>
        {dropdownOpen && (
          <View style={[styles.dropdownList, { backgroundColor: palette.card }]}>
            {vehicles.map((vehicle) => (
              <Pressable
                key={vehicle.id}
                style={styles.dropdownOption}
                onPress={() => {
                  setVehicleId(vehicle.id);
                  setMode(null);
                  setDropdownOpen(false);
                }}
              >
                <Text style={styles.vehicleTypeIcon}>{vehicleIcon(vehicle.vehicle_type)}</Text>
                <View style={styles.vehicleListCopy}>
                  <Text style={{ color: palette.text, fontWeight: '800' }}>
                    {vehicle.make} {vehicle.model}
                  </Text>
                  <Text style={{ color: palette.muted }}>{vehicle.registration_number}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {selectedVehicle && (
        <View style={styles.updateChoiceRow}>
          <Pressable
            style={[styles.updateChoice, mode === 'mileage' && styles.updateChoiceMileage]}
            onPress={() => setMode('mileage')}
          >
            <Text style={styles.updateChoiceIcon}>◷</Text>
            <Text style={[styles.updateChoiceTitle, { color: mode === 'mileage' ? '#fff' : palette.text }]}>
              Mileage update
            </Text>
            <Text style={{ color: mode === 'mileage' ? '#dce7ff' : palette.muted }}>
              Record distance
            </Text>
          </Pressable>
          <Pressable
            style={[styles.updateChoice, mode === 'inspection' && styles.updateChoiceInspection]}
            onPress={() => setMode('inspection')}
          >
            <Text style={styles.updateChoiceIcon}>✓</Text>
            <Text
              style={[styles.updateChoiceTitle, { color: mode === 'inspection' ? '#fff' : palette.text }]}
            >
              Inspection update
            </Text>
            <Text style={{ color: mode === 'inspection' ? '#dce7ff' : palette.muted }}>
              Check condition
            </Text>
          </Pressable>
        </View>
      )}
      {mode && (
        <View style={[styles.updateForm, { backgroundColor: palette.card }]}>
          <Text style={[styles.detailSectionTitle, { color: palette.text }]}>
            {mode === 'mileage' ? 'Mileage details' : 'Inspection details'}
          </Text>
          <DatePickerField label="Date" value={date} onChange={setDate} palette={palette} />
          {mode === 'mileage' ? (
            <Field
              label="Odometer reading (km)"
              value={odometer}
              onChange={setOdometer}
              palette={palette}
              keyboardType="decimal-pad"
            />
          ) : (
            <>
              <Field
                label="Odometer reading (km)"
                value={inspectionOdometer}
                onChange={setInspectionOdometer}
                palette={palette}
                keyboardType="decimal-pad"
              />
              <Field
                label="Overall condition"
                value={condition}
                onChange={setCondition}
                palette={palette}
              />
            </>
          )}
          <Field
            label="Remarks"
            value={mode === 'mileage' ? mileageRemarks : inspectionRemarks}
            onChange={mode === 'mileage' ? setMileageRemarks : setInspectionRemarks}
            palette={palette}
          />
          {canManage && (
            <Button
              title={mode === 'mileage' ? 'Save mileage' : 'Save inspection'}
              onPress={() => void (mode === 'mileage' ? saveMileage() : saveInspection())}
            />
          )}
        </View>
      )}
      {selectedVehicle && mode === 'mileage' && (
        <>
          <View style={styles.historyHeader}>
            <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Recent mileage</Text>
            <Text style={[styles.sectionHint, { color: palette.muted }]}>Latest reading</Text>
          </View>
          {mileageRows.length ? (
            <View style={[styles.historyCard, { backgroundColor: palette.card }]}>
              <Text style={[styles.historyValue, { color: palette.text }]}>
                {String(mileageRows[0].odometer_reading)} km
              </Text>
              <Text style={{ color: palette.muted }}>{String(mileageRows[0].reading_date)}</Text>
              {mileageRows[0].notes ? (
                <Text style={{ color: palette.muted }}>{String(mileageRows[0].notes)}</Text>
              ) : null}
              <Button
                title="View mileage history"
                variant="secondary"
                onPress={() => setHistoryView('mileage')}
              />
            </View>
          ) : (
            <Text style={{ color: palette.muted }}>No mileage readings for this vehicle.</Text>
          )}
        </>
      )}
      {selectedVehicle && mode === 'inspection' && (
        <>
          <View style={styles.historyHeader}>
            <Text style={[styles.detailSectionTitle, { color: palette.text }]}>
              Recent inspections
            </Text>
            <Text style={[styles.sectionHint, { color: palette.muted }]}>Latest inspection</Text>
          </View>
          {inspectionRows.length ? (
            <View style={[styles.historyCard, { backgroundColor: palette.card }]}>
              <Text style={[styles.historyValue, { color: palette.text }]}>
                {String(inspectionRows[0].overall_condition)}
              </Text>
              <Text style={{ color: palette.muted }}>{String(inspectionRows[0].inspection_date)}</Text>
              <Text style={{ color: palette.muted }}>
                Odometer: {String(inspectionRows[0].odometer_reading)} km
              </Text>
              {inspectionRows[0].remarks ? (
                <Text style={{ color: palette.muted }}>{String(inspectionRows[0].remarks)}</Text>
              ) : null}
              <Button
                title="View inspection history"
                variant="success"
                onPress={() => setHistoryView('inspection')}
              />
            </View>
          ) : (
            <Text style={{ color: palette.muted }}>No inspections for this vehicle.</Text>
          )}
        </>
      )}
      <Modal
        visible={historyView !== null}
        animationType="slide"
        onRequestClose={() => setHistoryView(null)}
      >
        <View style={[styles.modalPage, { backgroundColor: palette.bg }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.vehicleDetailTitle, { color: palette.text }]}>
                {historyView === 'mileage' ? 'Mileage history' : 'Inspection history'}
              </Text>
              <Text style={{ color: palette.muted }}>
                {selectedVehicle?.registration_number ?? 'Selected vehicle'}
              </Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.panel}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              {historyView === 'mileage' ? (
                <View style={[styles.tableCard, { backgroundColor: palette.card }]}>
                <View style={styles.tableRow}>
                  <Text style={[styles.tableHeaderCell, styles.tableDateCell, { color: palette.text }]}>
                    Date
                  </Text>
                  <Text style={[styles.tableHeaderCell, styles.tableValueCell, { color: palette.text }]}>
                    Mileage
                  </Text>
                  <Text style={[styles.tableHeaderCell, styles.tableRemarksCell, { color: palette.text }]}>
                    Remarks
                  </Text>
                </View>
                {mileageRows.map((row) => (
                  <View key={row.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableDateCell, { color: palette.muted }]}>
                      {String(row.reading_date)}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableValueCell, { color: palette.muted }]}>
                      {String(row.odometer_reading)} km
                    </Text>
                    <Text style={[styles.tableCell, styles.tableRemarksCell, { color: palette.muted }]}>
                      {String(row.notes ?? '—')}
                    </Text>
                  </View>
                ))}
                </View>
              ) : (
                <View style={[styles.tableCard, { backgroundColor: palette.card }]}>
                <View style={styles.tableRow}>
                  <Text style={[styles.tableHeaderCell, styles.tableDateCell, { color: palette.text }]}>
                    Date
                  </Text>
                  <Text style={[styles.tableHeaderCell, styles.tableValueCell, { color: palette.text }]}>
                    Odometer
                  </Text>
                  <Text style={[styles.tableHeaderCell, styles.tableConditionCell, { color: palette.text }]}>
                    Condition
                  </Text>
                  <Text style={[styles.tableHeaderCell, styles.tableRemarksCell, { color: palette.text }]}>
                    Remarks
                  </Text>
                </View>
                {inspectionRows.map((row) => (
                  <View key={row.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableDateCell, { color: palette.muted }]}>
                      {String(row.inspection_date)}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableValueCell, { color: palette.muted }]}>
                      {String(row.odometer_reading)} km
                    </Text>
                    <Text style={[styles.tableCell, styles.tableConditionCell, { color: palette.muted }]}>
                      {String(row.overall_condition ?? '—')}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableRemarksCell, { color: palette.muted }]}>
                      {String(row.remarks ?? '—')}
                    </Text>
                  </View>
                ))}
                </View>
              )}
            </ScrollView>
          </ScrollView>
        </View>
      </Modal>
    </Panel>
  );
}

function Fuel({
  vehicles,
  canManage,
  userId,
  palette,
}: {
  vehicles: VehicleRecord[];
  canManage: boolean;
  userId: string;
  palette: { bg: string; card: string; text: string; muted: string };
}) {
  const [vehicleId, setVehicleId] = useState('');
  const [fuelType, setFuelType] = useState<'Petrol' | 'Diesel'>('Petrol');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [litres, setLitres] = useState('');
  const [costPerLitre, setCostPerLitre] = useState('');
  const [odometer, setOdometer] = useState('');
  const [fuelStation, setFuelStation] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptUri, setReceiptUri] = useState('');
  const [fuelTypeOpen, setFuelTypeOpen] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const totalCost = Number.parseFloat(litres) * Number.parseFloat(costPerLitre);

  const loadRecords = async () => {
    const { data, error } = await supabase
      .from('fuel_records')
      .select(
        'id, vehicle_id, refuel_date, fuel_type, litres, cost_per_litre, total_cost, odometer_reading, fuel_station, receipt_path, notes',
      )
      .order('refuel_date', { ascending: false });
    if (error) {
      Alert.alert('Unable to load fuel records', error.message);
      return;
    }
    setRows((data ?? []) as RecordRow[]);
  };
  useEffect(() => {
    void loadRecords();
  }, []);

  const save = async () => {
    if (!canManage) return;
    const litresValue = Number.parseFloat(litres);
    const priceValue = Number.parseFloat(costPerLitre);
    const odometerValue = odometer ? Number.parseFloat(odometer) : null;
    if (
      !vehicleId ||
      !date ||
      date > new Date().toISOString().slice(0, 10) ||
      !Number.isFinite(litresValue) ||
      litresValue <= 0 ||
      !Number.isFinite(priceValue) ||
      priceValue < 0 ||
      (odometer && (!Number.isFinite(odometerValue) || (odometerValue ?? 0) < 0))
    ) {
      Alert.alert(
        'Required',
        'Select a vehicle, choose a valid past or current date, and enter valid litres and cost per litre.',
      );
      return;
    }
    try {
      let receiptPath: string | null = null;
      if (receiptUri) {
        receiptPath = `${vehicleId}/fuel/${Date.now()}-${receiptUri.split('/').pop() ?? 'receipt'}`;
        const normalizedUri = await normalizeImage(receiptUri);
        const file = await new FileSystem.File(normalizedUri).bytes();
        const { error: uploadError } = await supabase.storage
          .from('vehicle-documents')
          .upload(receiptPath, file, { upsert: false, contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
      }
      const { error } = await supabase.from('fuel_records').insert({
        vehicle_id: vehicleId,
        recorded_by: userId,
        refuel_date: date,
        fuel_type: fuelType,
        litres: litresValue,
        cost_per_litre: priceValue,
        total_cost: Number(totalCost.toFixed(2)),
        odometer_reading: odometerValue,
        fuel_station: fuelStation || null,
        receipt_path: receiptPath,
        notes: notes || null,
      });
      if (error) throw error;
      setLitres('');
      setCostPerLitre('');
      setOdometer('');
      setFuelStation('');
      setNotes('');
      setReceiptUri('');
      await loadRecords();
      Alert.alert('Saved', 'Fuel record added.');
    } catch (error) {
      Alert.alert('Unable to save fuel record', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const visibleRows = rows.filter((row) => row.vehicle_id === vehicleId);
  return (
    <Panel>
      <View style={styles.operationsIntro}>
        <Heading palette={palette}>Fuel and refuelling</Heading>
        <Text style={{ color: palette.muted }}>
          Record each refuelling event against the exact vehicle.
        </Text>
      </View>
      {!canManage && <Text style={{ color: palette.muted }}>Management access is read-only.</Text>}
      <View style={styles.dropdownWrap}>
        <Text style={[styles.fieldLabel, { color: palette.muted }]}>Vehicle</Text>
        <Pressable
          style={[styles.dropdownButton, { backgroundColor: palette.card }]}
          onPress={() => setVehicleOpen(!vehicleOpen)}
        >
          <Text style={{ color: selectedVehicle ? palette.text : palette.muted }}>
            {selectedVehicle
              ? `${vehicleIcon(selectedVehicle.vehicle_type)}  ${selectedVehicle.make} ${selectedVehicle.model} · ${selectedVehicle.registration_number}`
              : 'Select a registered vehicle'}
          </Text>
          <Text style={{ color: palette.muted }}>{vehicleOpen ? '⌃' : '⌄'}</Text>
        </Pressable>
        {vehicleOpen && (
          <View style={[styles.dropdownList, { backgroundColor: palette.card }]}>
            {vehicles.map((vehicle) => (
              <Pressable
                key={vehicle.id}
                style={styles.dropdownOption}
                onPress={() => {
                  setVehicleId(vehicle.id);
                  setVehicleOpen(false);
                }}
              >
                <Text style={styles.vehicleTypeIcon}>{vehicleIcon(vehicle.vehicle_type)}</Text>
                <View style={styles.vehicleListCopy}>
                  <Text style={{ color: palette.text, fontWeight: '800' }}>
                    {vehicle.make} {vehicle.model}
                  </Text>
                  <Text style={{ color: palette.muted }}>{vehicle.registration_number}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {selectedVehicle && selectedVehicle.energy_type !== 'fuel' && (
        <View style={[styles.detailCard, { backgroundColor: palette.card }]}>
          <Text style={[styles.detailSectionTitle, { color: palette.text }]}>
            Refuelling is not applicable
          </Text>
          <Text style={{ color: palette.muted }}>
            This vehicle is registered as electric, so fuel records cannot be added.
          </Text>
        </View>
      )}
      {selectedVehicle?.energy_type === 'fuel' && (
        <View style={[styles.updateForm, { backgroundColor: palette.card }]}>
          <DatePickerField label="Refuelling date" value={date} onChange={setDate} palette={palette} />
          <View style={styles.dropdownWrap}>
            <Text style={[styles.fieldLabel, { color: palette.muted }]}>Fuel type</Text>
            <Pressable
              style={[styles.dropdownButton, { backgroundColor: palette.card }]}
              onPress={() => setFuelTypeOpen(!fuelTypeOpen)}
            >
              <Text style={{ color: palette.text }}>{fuelType}</Text>
              <Text style={{ color: palette.muted }}>{fuelTypeOpen ? '⌃' : '⌄'}</Text>
            </Pressable>
            {fuelTypeOpen && (
              <View style={[styles.dropdownList, { backgroundColor: palette.card }]}>
                {(['Petrol', 'Diesel'] as const).map((option) => (
                  <Pressable
                    key={option}
                    style={styles.dropdownOption}
                    onPress={() => {
                      setFuelType(option);
                      setFuelTypeOpen(false);
                    }}
                  >
                    <Text style={{ color: palette.text }}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          <Field
            label="Quantity (litres)"
            value={litres}
            onChange={setLitres}
            palette={palette}
            keyboardType="decimal-pad"
          />
          <Field
            label="Cost per litre (LKR)"
            value={costPerLitre}
            onChange={setCostPerLitre}
            palette={palette}
            keyboardType="decimal-pad"
          />
          <View style={[styles.totalCostBox, { backgroundColor: palette.bg }]}>
            <Text style={{ color: palette.muted }}>Total cost</Text>
            <Text style={[styles.historyValue, { color: palette.text }]}>
              LKR {Number.isFinite(totalCost) ? totalCost.toFixed(2) : '0.00'}
            </Text>
          </View>
          <Field
            label="Odometer reading (km, optional)"
            value={odometer}
            onChange={setOdometer}
            palette={palette}
            keyboardType="decimal-pad"
          />
          <Field label="Fuel station (optional)" value={fuelStation} onChange={setFuelStation} palette={palette} />
          <Field label="Notes (optional)" value={notes} onChange={setNotes} palette={palette} />
          <Pressable
            style={[styles.attachmentBox, { borderColor: colors.border }]}
            onPress={() => void choosePhoto().then((uri) => uri && setReceiptUri(uri))}
          >
            {receiptUri ? (
              <Image source={{ uri: receiptUri }} style={styles.attachmentThumbnail} />
            ) : (
              <Text style={styles.attachmentPlaceholder}>Upload fuel receipt</Text>
            )}
          </Pressable>
          {canManage && <Button title="Save fuel record" onPress={() => void save()} />}
        </View>
      )}
      {selectedVehicle?.energy_type === 'fuel' && (
        <View style={styles.fuelHistorySection}>
          <View style={styles.historyHeader}>
            <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Latest refuelling</Text>
            <Text style={[styles.sectionHint, { color: palette.muted }]}>Current vehicle</Text>
          </View>
          {visibleRows.length ? (
            <View style={[styles.historyCard, { backgroundColor: palette.card }]}>
              <Text style={[styles.historyValue, { color: palette.text }]}>
                {String(visibleRows[0].refuel_date)} · {String(visibleRows[0].fuel_type)}
              </Text>
              <Text style={{ color: palette.muted }}>
                {String(visibleRows[0].litres)} L · LKR {String(visibleRows[0].cost_per_litre)}/L · Total LKR{' '}
                {String(visibleRows[0].total_cost)}
              </Text>
              <Text style={{ color: palette.muted }}>
                Odometer: {visibleRows[0].odometer_reading == null ? '—' : `${String(visibleRows[0].odometer_reading)} km`}
              </Text>
              {visibleRows[0].fuel_station ? (
                <Text style={{ color: palette.muted }}>Station: {String(visibleRows[0].fuel_station)}</Text>
              ) : null}
              <Button
                title="View previous refuelling"
                variant="secondary"
                onPress={() => setShowHistory(true)}
              />
            </View>
          ) : (
            <Text style={{ color: palette.muted }}>No fuel records for this vehicle.</Text>
          )}
        </View>
      )}
      <Modal visible={showHistory} animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <View style={[styles.modalPage, { backgroundColor: palette.bg }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.vehicleDetailTitle, { color: palette.text }]}>Refuelling history</Text>
              <Text style={{ color: palette.muted }}>{selectedVehicle?.registration_number}</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.panel}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={[styles.tableCard, styles.fuelTableCard, { backgroundColor: palette.card }]}>
                <View style={styles.tableRow}>
                  {[
                    { label: 'Date', style: styles.tableDateCell },
                    { label: 'Fuel type', style: styles.tableFuelTypeCell },
                    { label: 'Litres', style: styles.tableFuelNumberCell },
                    { label: 'Cost/L', style: styles.tableFuelNumberCell },
                    { label: 'Total', style: styles.tableFuelNumberCell },
                    { label: 'Odometer', style: styles.tableFuelNumberCell },
                    { label: 'Station', style: styles.tableFuelStationCell },
                  ].map(({ label, style }) => (
                    <Text key={label} style={[styles.tableHeaderCell, style, { color: palette.text }]}>
                      {label}
                    </Text>
                  ))}
                </View>
                {visibleRows.map((row) => (
                  <View key={row.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableDateCell, { color: palette.muted }]}>
                      {String(row.refuel_date)}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableFuelTypeCell, { color: palette.muted }]}>
                      {String(row.fuel_type)}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableFuelNumberCell, { color: palette.muted }]}>
                      {String(row.litres)} L
                    </Text>
                    <Text style={[styles.tableCell, styles.tableFuelNumberCell, { color: palette.muted }]}>
                      LKR {String(row.cost_per_litre)}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableFuelNumberCell, { color: palette.muted }]}>
                      LKR {String(row.total_cost)}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableFuelNumberCell, { color: palette.muted }]}>
                      {row.odometer_reading == null ? '—' : `${String(row.odometer_reading)} km`}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableFuelStationCell, { color: palette.muted }]}>
                      {String(row.fuel_station ?? '—')}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      </Modal>
    </Panel>
  );
}

function Compliance({
  vehicles,
  canManage,
  palette,
}: {
  vehicles: VehicleRecord[];
  canManage: boolean;
  palette: { bg: string; card: string; text: string; muted: string };
}) {
  const [vehicleId, setVehicleId] = useState('');
  const [type, setType] = useState('');
  const [issue, setIssue] = useState('');
  const [expiry, setExpiry] = useState('');
  const [reference, setReference] = useState('');
  const [fileUri, setFileUri] = useState('');
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [view, setView] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const complianceTypes =
    selectedVehicle?.energy_type === 'electric'
      ? ['Revenue Licence', 'Insurance']
      : ['Revenue Licence', 'Emission Test', 'Insurance'];
  const load = async () => {
    const { data } = await supabase
      .from('compliance_records')
      .select(
        'id, vehicle_id, compliance_type, issue_date, expiry_date, reference_number, status, file_path, updated_at, created_at',
      )
      .order('updated_at', { ascending: false });
    setRows((data ?? []) as RecordRow[]);
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!type) {
      setIssue('');
      setExpiry('');
      setReference('');
      setFileUri('');
      return;
    }
    const existing = rows.find(
      (row) => row.vehicle_id === vehicleId && row.compliance_type === type,
    );
    setIssue(String(existing?.issue_date ?? ''));
    setExpiry(String(existing?.expiry_date ?? ''));
    setReference(String(existing?.reference_number ?? ''));
    setFileUri('');
  }, [vehicleId, type, rows]);
  const save = async () => {
    if (!canManage || !vehicleId || !type) {
      Alert.alert('Required', 'Select a vehicle before saving compliance.');
      return;
    }
    if (selectedVehicle?.energy_type === 'electric' && type === 'Emission Test') {
      Alert.alert('Not applicable', 'Electric vehicles do not require an emission test.');
      return;
    }
    if (!fileUri) {
      Alert.alert('Photo evidence required', 'Upload a certificate photo before saving this record.');
      return;
    }
    const { data: existingRecords, error: existingError } = await supabase
      .from('compliance_records')
      .select('id, file_path, expiry_date')
      .eq('vehicle_id', vehicleId)
      .eq('compliance_type', type)
      .order('expiry_date', { ascending: false });
    if (existingError) {
      Alert.alert('Unable to check existing compliance', existingError.message);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const activeRecord = (existingRecords ?? []).find(
      (record) => record.expiry_date && String(record.expiry_date) >= today,
    );
    if (activeRecord) {
      Alert.alert(
        'Certificate still valid',
        `${type} cannot be added again until the existing certificate expires.`,
      );
      return;
    }
    let uploadedPath: string | null = null;
    try {
      if (fileUri) {
        uploadedPath = `${vehicleId}/compliance-${Date.now()}-${fileUri.split('/').pop() ?? 'certificate'}`;
        const normalizedUri = await normalizeImage(fileUri);
        const file = await new FileSystem.File(normalizedUri).bytes();
        const { error: uploadError } = await supabase.storage
          .from('vehicle-documents')
          .upload(uploadedPath, file, { upsert: false, contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
      }
      const values = {
        vehicle_id: vehicleId,
        compliance_type: type,
        issue_date: issue || null,
        expiry_date: expiry || null,
        reference_number: reference || null,
        status: expiry && expiry < new Date().toISOString().slice(0, 10) ? 'expired' : 'active',
        ...(uploadedPath ? { file_path: uploadedPath } : {}),
      };
      const result = await supabase.from('compliance_records').insert(values);
      if (result.error) throw result.error;
      setFileUri('');
      await load();
      Alert.alert('Saved', `${type} compliance record saved.`);
    } catch (e) {
      if (uploadedPath) await supabase.storage.from('vehicle-documents').remove([uploadedPath]);
      Alert.alert('Unable to save compliance', e instanceof Error ? e.message : 'Try again.');
    }
  };
  return (
    <Panel>
      <Heading palette={palette}>Compliance certificates</Heading>
      <Text style={{ color: palette.muted }}>
        Keep the revenue licence, emission test, and insurance certificate for each vehicle in one
        place.
      </Text>
      {!canManage && <Text style={{ color: palette.muted }}>Management access is read-only.</Text>}
      <View style={styles.dropdownWrap}>
        <Text style={[styles.fieldLabel, { color: palette.muted }]}>Vehicle</Text>
        <Pressable
          style={[styles.dropdownButton, { backgroundColor: palette.card }]}
          onPress={() => setDropdownOpen(!dropdownOpen)}
        >
          <Text style={{ color: selectedVehicle ? palette.text : palette.muted }}>
            {selectedVehicle
              ? `${vehicleIcon(selectedVehicle.vehicle_type)}  ${selectedVehicle.make} ${selectedVehicle.model} · ${selectedVehicle.registration_number}`
              : 'Select a registered vehicle'}
          </Text>
          <Text style={{ color: palette.muted }}>{dropdownOpen ? '⌃' : '⌄'}</Text>
        </Pressable>
        {dropdownOpen && (
          <View style={[styles.dropdownList, { backgroundColor: palette.card }]}>
            {vehicles.map((vehicle) => (
              <Pressable
                key={vehicle.id}
                style={styles.dropdownOption}
                onPress={() => {
                  setVehicleId(vehicle.id);
                  setType('');
                  setTypeOpen(false);
                  setDropdownOpen(false);
                }}
              >
                <Text style={styles.vehicleTypeIcon}>{vehicleIcon(vehicle.vehicle_type)}</Text>
                <View style={styles.vehicleListCopy}>
                  <Text style={{ color: palette.text, fontWeight: '800' }}>
                    {vehicle.make} {vehicle.model}
                  </Text>
                  <Text style={{ color: palette.muted }}>{vehicle.registration_number}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {!selectedVehicle ? (
        <Text style={{ color: palette.muted }}>
          Choose a vehicle to add or view its compliance certificates.
        </Text>
      ) : (
        <>
          <View style={[styles.updateForm, { backgroundColor: palette.card }]}>
            <Text style={[styles.fieldLabel, { color: palette.muted }]}>Certificate type</Text>
            <Pressable
              style={[styles.dropdownButton, { backgroundColor: palette.card }]}
              onPress={() => setTypeOpen(!typeOpen)}
            >
              <Text style={{ color: type ? palette.text : palette.muted }}>
                {type || 'Select certificate type'}
              </Text>
              <Text style={{ color: palette.muted }}>{typeOpen ? '⌃' : '⌄'}</Text>
            </Pressable>
            {typeOpen && (
              <View style={[styles.dropdownList, { backgroundColor: palette.card }]}>
                {complianceTypes.map((option) => (
                  <Pressable
                    key={option}
                    style={styles.dropdownOption}
                    onPress={() => {
                      setType(option);
                      setTypeOpen(false);
                    }}
                  >
                    <Text style={{ color: palette.text }}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {type ? (
              <>
                <Text style={[styles.detailSectionTitle, { color: palette.text }]}>
                  {type} details
                </Text>
                <DatePickerField label="Issued date" value={issue} onChange={setIssue} palette={palette} />
                <DatePickerField
                  label="Expiry date"
                  value={expiry}
                  onChange={setExpiry}
                  palette={palette}
                  allowFuture
                />
                <Field
                  label="Reference number"
                  value={reference}
                  onChange={setReference}
                  palette={palette}
                />
                {canManage && (
                  <>
                    <Pressable
                      style={[styles.attachmentBox, { borderColor: colors.border }]}
                      onPress={() => void choosePhoto().then((uri) => uri && setFileUri(uri))}
                    >
                      {fileUri ? (
                        <Image source={{ uri: fileUri }} style={styles.attachmentThumbnail} />
                      ) : (
                        <Text style={styles.attachmentPlaceholder}>Upload certificate</Text>
                      )}
                    </Pressable>
                    <Button title="Save compliance certificate" onPress={() => void save()} />
                  </>
                )}
              </>
            ) : (
              <Text style={{ color: palette.muted }}>Select a certificate type to enter its details.</Text>
            )}
          </View>
        </>
      )}
      <Modal visible={!!view} transparent animationType="fade" onRequestClose={() => setView(null)}>
        <View style={styles.overlay}>
          <View style={[styles.viewer, { backgroundColor: palette.card }]}>
            <Heading palette={palette}>Compliance certificate</Heading>
            {view ? <SignedContent path={view} /> : null}
          </View>
        </View>
      </Modal>
    </Panel>
  );
}

function Maintenance({
  vehicles,
  canManage,
  userId,
  palette,
}: {
  vehicles: VehicleRecord[];
  canManage: boolean;
  userId: string;
  palette: { bg: string; card: string; text: string; muted: string };
}) {
  const [vehicleId, setVehicleId] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [handoverDate, setHandoverDate] = useState('');
  const [retrievalDate, setRetrievalDate] = useState('');
  const [odometer, setOdometer] = useState('');
  const [serviceType, setServiceType] = useState('Preventive service');
  const [serviceTypeOpen, setServiceTypeOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [serviceStation, setServiceStation] = useState('');
  const [cost, setCost] = useState('');
  const [attachmentUris, setAttachmentUris] = useState<string[]>([]);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [attachments, setAttachments] = useState<RecordRow[]>([]);
  const [view, setView] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const load = async () => {
    const maintenance = await supabase
      .from('maintenance_records')
      .select(
        'id, vehicle_id, service_date, handover_date, retrieval_date, odometer_reading, service_type, description, service_station, cost, document_path',
      )
      .order('service_date', { ascending: false });
    let maintenanceData = maintenance.data as RecordRow[] | null;
    if (maintenance.error) {
      const legacyMaintenance = await supabase
        .from('maintenance_records')
        .select(
          'id, vehicle_id, service_date, odometer_reading, service_type, description, provider, cost, document_path',
        )
        .order('service_date', { ascending: false });
      if (legacyMaintenance.error) {
        Alert.alert('Unable to load maintenance records', legacyMaintenance.error.message);
        return;
      }
      maintenanceData = (legacyMaintenance.data ?? []).map((row) => ({
        ...(row as RecordRow),
        service_station: row.provider ?? null,
      }));
    }
    if (!maintenanceData) {
      Alert.alert('Unable to load maintenance records', 'No maintenance records were returned.');
      return;
    }
    setRows(maintenanceData);
    const maintenanceAttachments = await supabase
      .from('maintenance_attachments')
      .select('id, maintenance_record_id, vehicle_id, attachment_type, file_path, created_at')
      .order('created_at', { ascending: false });
    setAttachments(
      maintenanceAttachments.error ? [] : ((maintenanceAttachments.data ?? []) as RecordRow[]),
    );
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async () => {
    if (!canManage) return;
    if (!vehicleId || !serviceDate || !handoverDate || !odometer || !serviceStation) {
      Alert.alert(
        'Required',
        'Vehicle, service date, handover date, odometer, and service station are required.',
      );
      return;
    }
    if (retrievalDate && retrievalDate < handoverDate) {
      Alert.alert('Invalid dates', 'Retrieval date cannot be before the handover date.');
      return;
    }
    const odometerValue = Number.parseFloat(odometer);
    const costValue = cost.trim() ? Number.parseFloat(cost) : null;
    if (!Number.isFinite(odometerValue) || odometerValue < 0) {
      Alert.alert('Invalid odometer', 'Enter a valid odometer reading in kilometres.');
      return;
    }
    if (costValue !== null && (!Number.isFinite(costValue) || costValue < 0)) {
      Alert.alert('Invalid cost', 'Enter a valid cost in LKR.');
      return;
    }
    const attachmentPaths: string[] = [];
    let maintenanceId = '';
    let schemaWarning = false;
    try {
      const modernInsert = await supabase
        .from('maintenance_records')
        .insert({
          vehicle_id: vehicleId,
          service_date: serviceDate,
          handover_date: handoverDate,
          retrieval_date: retrievalDate || null,
          odometer_reading: odometerValue,
          service_type: serviceType,
          description,
          service_station: serviceStation,
          cost: costValue,
        })
        .select('id')
        .single();
      if (modernInsert.error) {
        if (!isMissingSchemaField(modernInsert.error.message)) throw modernInsert.error;
        const legacyInsert = await supabase
          .from('maintenance_records')
          .insert({
            vehicle_id: vehicleId,
            service_date: serviceDate,
            odometer_reading: odometerValue,
            service_type: serviceType,
            description,
            provider: serviceStation,
            cost: costValue,
          })
          .select('id')
          .single();
        if (legacyInsert.error) throw legacyInsert.error;
        maintenanceId = String(legacyInsert.data.id);
        schemaWarning = true;
      } else {
        maintenanceId = String(modernInsert.data.id);
      }
      for (const attachmentUri of schemaWarning ? [] : attachmentUris) {
        const attachmentPath = `${vehicleId}/maintenance/${maintenanceId}/${Date.now()}-${attachmentUri.split('/').pop() ?? 'attachment'}`;
        attachmentPaths.push(attachmentPath);
        const normalizedUri = await normalizeImage(attachmentUri);
        const file = await new FileSystem.File(normalizedUri).bytes();
        const { error: uploadError } = await supabase.storage
          .from('vehicle-documents')
          .upload(attachmentPath, file, {
            upsert: false,
            contentType: 'image/jpeg',
          });
        if (uploadError) throw uploadError;
        const { error: attachmentError } = await supabase
          .from('maintenance_attachments')
          .insert({
            maintenance_record_id: maintenanceId,
            vehicle_id: vehicleId,
            attachment_type: 'Receipt',
            file_path: attachmentPath,
            uploaded_by: userId,
          });
        if (attachmentError) {
          if (!isMissingSchemaField(attachmentError.message)) throw attachmentError;
          await supabase.storage.from('vehicle-documents').remove([attachmentPath]);
          attachmentPaths.pop();
          schemaWarning = true;
        }
      }
      if (attachmentPaths.length) {
        const { error: pathError } = await supabase
          .from('maintenance_records')
          .update({ document_path: attachmentPaths[0] })
          .eq('id', maintenanceId);
        if (pathError) throw pathError;
      }
      setAttachmentUris([]);
      await load();
      setShowForm(false);
      Alert.alert(
        'Saved',
        schemaWarning
          ? 'Maintenance record saved. Apply the latest database migrations to store service dates and attachments.'
          : 'Maintenance record added.',
      );
    } catch (e) {
      if (attachmentPaths.length)
        await supabase.storage.from('vehicle-documents').remove(attachmentPaths);
      if (maintenanceId) await supabase.from('maintenance_records').delete().eq('id', maintenanceId);
      Alert.alert('Unable to save maintenance', e instanceof Error ? e.message : 'Try again.');
    }
  };
  const visibleRows = rows.filter((row) => row.vehicle_id === vehicleId);
  return (
    <Panel>
      <Heading palette={palette}>Maintenance and repairs</Heading>
      {!canManage && <Text style={{ color: palette.muted }}>Management access is read-only.</Text>}
      <View style={styles.dropdownWrap}>
        <Text style={[styles.fieldLabel, { color: palette.muted }]}>Vehicle</Text>
        <Pressable
          style={[styles.dropdownButton, { backgroundColor: palette.card }]}
          onPress={() => setDropdownOpen(!dropdownOpen)}
        >
          <Text style={{ color: selectedVehicle ? palette.text : palette.muted }}>
            {selectedVehicle
              ? `${vehicleIcon(selectedVehicle.vehicle_type)}  ${selectedVehicle.make} ${selectedVehicle.model} · ${selectedVehicle.registration_number}`
              : 'Select a registered vehicle'}
          </Text>
          <Text style={{ color: palette.muted }}>{dropdownOpen ? '⌃' : '⌄'}</Text>
        </Pressable>
        {dropdownOpen && (
          <View style={[styles.dropdownList, { backgroundColor: palette.card }]}>
            {vehicles.map((vehicle) => (
              <Pressable
                key={vehicle.id}
                style={styles.dropdownOption}
                onPress={() => {
                  setVehicleId(vehicle.id);
                  setAttachmentUris([]);
                  setShowForm(true);
                  setDropdownOpen(false);
                }}
              >
                <Text style={styles.vehicleTypeIcon}>{vehicleIcon(vehicle.vehicle_type)}</Text>
                <View style={styles.vehicleListCopy}>
                  <Text style={{ color: palette.text, fontWeight: '800' }}>
                    {vehicle.make} {vehicle.model}
                  </Text>
                  <Text style={{ color: palette.muted }}>{vehicle.registration_number}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {!selectedVehicle ? (
        <Text style={{ color: palette.muted }}>
          Choose a vehicle to add or view its maintenance records.
        </Text>
      ) : showForm ? (
        <View style={[styles.updateForm, { backgroundColor: palette.card }]}>
          <DatePickerField
            label="Work completed on"
            value={serviceDate}
            onChange={setServiceDate}
            palette={palette}
          />
          <DatePickerField
            label="Sent to service on"
            value={handoverDate}
            onChange={setHandoverDate}
            palette={palette}
          />
          <DatePickerField
            label="Returned from service on (optional)"
            value={retrievalDate}
            onChange={setRetrievalDate}
            palette={palette}
          />
          <Field
            label="What was repaired or serviced?"
            value={description}
            onChange={setDescription}
            palette={palette}
          />
          <View style={styles.dropdownWrap}>
            <Text style={[styles.fieldLabel, { color: palette.muted }]}>Service type</Text>
            <Pressable
              style={[styles.dropdownButton, { backgroundColor: palette.card }]}
              onPress={() => setServiceTypeOpen(!serviceTypeOpen)}
            >
              <Text style={{ color: palette.text }}>{serviceType}</Text>
              <Text style={{ color: palette.muted }}>{serviceTypeOpen ? '⌃' : '⌄'}</Text>
            </Pressable>
            {serviceTypeOpen && (
              <View style={[styles.dropdownList, { backgroundColor: palette.card }]}>
                {['Minor service', 'Full (standard) service', 'Major service', 'Repair', 'Inspection'].map(
                  (option) => (
                    <Pressable
                      key={option}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setServiceType(option);
                        setServiceTypeOpen(false);
                      }}
                    >
                      <Text style={{ color: palette.text }}>{option}</Text>
                    </Pressable>
                  ),
                )}
              </View>
            )}
          </View>
          <Field
            label="Odometer reading (km)"
            value={odometer}
            onChange={setOdometer}
            palette={palette}
            keyboardType="decimal-pad"
          />
          <Field
            label="Service station / garage"
            value={serviceStation}
            onChange={setServiceStation}
            palette={palette}
          />
          <Field
            label="Cost (LKR)"
            value={cost}
            onChange={setCost}
            palette={palette}
            keyboardType="decimal-pad"
          />
          {canManage && (
            <Pressable
              style={[styles.attachmentBox, { borderColor: colors.border }]}
              onPress={() =>
                void choosePhoto().then(
                  (uri) => uri && setAttachmentUris((current) => [...current, uri]),
                )
              }
            >
              <View style={styles.attachmentPicker}>
                {attachmentUris.length ? (
                  <ScrollView horizontal contentContainerStyle={styles.attachmentGallery}>
                    {attachmentUris.map((uri) => (
                      <Image key={uri} source={{ uri }} style={styles.attachmentThumbnail} />
                    ))}
                    <View style={styles.attachmentAddTile}>
                      <Text style={styles.attachmentAddText}>+</Text>
                    </View>
                  </ScrollView>
                ) : (
                  <Text style={styles.attachmentPlaceholder}>Upload invoice</Text>
                )}
              </View>
            </Pressable>
          )}
          {canManage && <Button title="Save maintenance record" onPress={() => void save()} />}
        </View>
      ) : null}
      {selectedVehicle && (
        <View style={styles.recordActions}>
          <Button
            title="View previous records"
            variant="secondary"
            onPress={() => setShowHistory(true)}
          />
          {canManage && (
            <Button title="Add new record" variant="success" onPress={() => setShowForm(true)} />
          )}
        </View>
      )}
      <Modal visible={showHistory} animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <View style={[styles.modalPage, { backgroundColor: palette.bg }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Previous maintenance</Text>
              <Text style={{ color: palette.muted }}>
                {selectedVehicle?.registration_number ?? ''}
              </Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.panel}>
            {visibleRows.length ? (
              visibleRows.map((r) => (
                <View key={r.id} style={[styles.historyRecordCard, { backgroundColor: palette.card }]}>
                  <Text style={[styles.historyRecordTitle, { color: palette.text }]}>
                    {String(r.service_type)} · {String(r.service_date)}
                  </Text>
                  <Text style={{ color: palette.muted }}>
                    {String(r.service_station ?? 'No station')}
                  </Text>
                  <Text style={{ color: palette.muted }}>
                    Sent: {String(r.handover_date ?? '—')} · Returned:{' '}
                    {String(r.retrieval_date ?? 'Pending')}
                  </Text>
                  <Text style={{ color: palette.text }}>
                    {String(r.description ?? 'No repair description')}
                  </Text>
                  <Text style={{ color: palette.muted }}>
                    {r.odometer_reading == null ? '—' : `${String(r.odometer_reading)} km`} · LKR{' '}
                    {String(r.cost ?? '0.00')}
                  </Text>
                  {attachments
                    .filter((attachment) => attachment.maintenance_record_id === r.id)
                    .map((attachment) => (
                      <Button
                        key={attachment.id}
                        title={
                          attachment.attachment_type
                            ? `View ${String(attachment.attachment_type).toLowerCase()}`
                            : 'View attachment'
                        }
                        variant="secondary"
                        onPress={() => setView(String(attachment.file_path))}
                      />
                    ))}
                </View>
              ))
            ) : (
              <Text style={{ color: palette.muted }}>No previous maintenance records.</Text>
            )}
          </ScrollView>
        </View>
      </Modal>
      <Modal visible={!!view} transparent animationType="fade" onRequestClose={() => setView(null)}>
        <View style={styles.overlay}>
          <View style={[styles.viewer, { backgroundColor: palette.card }]}>
            <Heading palette={palette}>Maintenance receipt</Heading>
            {view ? <SignedContent path={view} /> : null}
          </View>
        </View>
      </Modal>
    </Panel>
  );
}

function SignedContent({ path, gallery = false }: { path: string; gallery?: boolean }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [fallbackTried, setFallbackTried] = useState(false);
  const loadSignedImage = async (signedUrl: string) => {
    try {
      setUrl(await normalizeImage(signedUrl));
    } catch {
      try {
        const cachedFile = await FileSystem.File.downloadFileAsync(
          signedUrl,
          new FileSystem.File(
            FileSystem.Paths.cache,
            `vehicle-photo-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
          ),
        );
        setUrl(cachedFile.uri);
      } catch {
        setUrl(signedUrl);
      }
    }
  };
  const loadFallback = async () => {
    setFallbackTried(true);
    const { data, error: downloadError } = await supabase.storage
      .from('vehicle-documents')
      .download(path);
    if (downloadError || !data) {
      setError(downloadError?.message ?? 'The image could not be downloaded from storage.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setUrl(reader.result);
      } else {
        setError('The downloaded image could not be displayed.');
      }
    };
    reader.onerror = () => setError('The downloaded image could not be displayed.');
    reader.readAsDataURL(data);
  };
  useEffect(() => {
    setUrl('');
    setError('');
    setFallbackTried(false);
    void supabase.storage
      .from('vehicle-documents')
      .createSignedUrl(path, 300)
      .then(({ data, error: signedUrlError }) => {
        if (signedUrlError) {
          if (!fallbackTried) {
            void loadFallback();
          } else {
            setError(signedUrlError.message);
          }
          return;
        }
        if (!data?.signedUrl) {
          if (!fallbackTried) {
            void loadFallback();
          } else {
            setError('The photo URL could not be created.');
          }
          return;
        }
        void loadSignedImage(data.signedUrl);
      });
  }, [path]);
  return url ? (
    <Image
      source={{ uri: url }}
      style={[styles.documentImage, gallery && styles.galleryImage]}
      resizeMode="cover"
      onError={() => {
        setUrl('');
        if (!fallbackTried) {
          void loadFallback();
        } else {
          setError('This image could not be loaded from storage.');
        }
      }}
    />
  ) : (
    <Text style={styles.error}>{error || 'Loading document...'}</Text>
  );
}

function VehicleProfile({
  vehicle,
  visible,
  onClose,
  onToggleArchive,
  canManage,
  userId,
  palette,
}: {
  vehicle: VehicleRecord | null;
  visible: boolean;
  onClose: () => void;
  onToggleArchive: () => Promise<void>;
  canManage: boolean;
  userId: string;
  palette: { bg: string; card: string; text: string; muted: string };
}) {
  const [mileage, setMileage] = useState<RecordRow[]>([]);
  const [maintenance, setMaintenance] = useState<RecordRow[]>([]);
  const [maintenanceAttachments, setMaintenanceAttachments] = useState<RecordRow[]>([]);
  const [inspections, setInspections] = useState<RecordRow[]>([]);
  const [compliance, setCompliance] = useState<RecordRow[]>([]);
  const [fuel, setFuel] = useState<RecordRow[]>([]);
  const [photos, setPhotos] = useState<RecordRow[]>([]);
  const [photoUri, setPhotoUri] = useState('');
  const [photoPickerVisible, setPhotoPickerVisible] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [viewFile, setViewFile] = useState<string | null>(null);
  const [tab, setTab] = useState('overview');
  const [profileSelectOpen, setProfileSelectOpen] = useState(false);
  useEffect(() => {
    if (!vehicle || !visible) return;
    const load = async () => {
      const [m, s, i, c, p, a, f] = await Promise.all([
        supabase
          .from('mileage_records')
          .select('*')
          .eq('vehicle_id', vehicle.id)
          .order('reading_date', { ascending: false }),
        supabase
          .from('maintenance_records')
          .select('*')
          .eq('vehicle_id', vehicle.id)
          .order('service_date', { ascending: false }),
        supabase
          .from('inspections')
          .select('*')
          .eq('vehicle_id', vehicle.id)
          .order('inspection_date', { ascending: false }),
        supabase
          .from('compliance_records')
          .select('*')
          .eq('vehicle_id', vehicle.id)
          .order('expiry_date'),
        supabase
          .from('vehicle_documents')
          .select('*')
          .eq('vehicle_id', vehicle.id)
          .eq('document_type', 'Vehicle Photo'),
        supabase
          .from('maintenance_attachments')
          .select('id, maintenance_record_id, vehicle_id, attachment_type, file_path, created_at')
          .eq('vehicle_id', vehicle.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('fuel_records')
          .select(
            'id, vehicle_id, refuel_date, fuel_type, litres, cost_per_litre, total_cost, odometer_reading, fuel_station, receipt_path, notes',
          )
          .eq('vehicle_id', vehicle.id)
          .order('refuel_date', { ascending: false }),
      ]);
      setMileage((m.data ?? []) as RecordRow[]);
      setMaintenance((s.data ?? []) as RecordRow[]);
      setInspections((i.data ?? []) as RecordRow[]);
      setCompliance((c.data ?? []) as RecordRow[]);
      const uniquePhotos = new Map<string, RecordRow>();
      for (const photo of (p.data ?? []) as RecordRow[]) {
        uniquePhotos.set(String(photo.file_path), photo);
      }
      setPhotos(Array.from(uniquePhotos.values()));
      setMaintenanceAttachments((a.data ?? []) as RecordRow[]);
      if (f.error) {
        Alert.alert('Unable to load fuel history', f.error.message);
        setFuel([]);
      } else {
        setFuel((f.data ?? []) as RecordRow[]);
      }
    };
    void load();
  }, [vehicle, visible]);
  if (!vehicle) return null;
  const addPhoto = async () => {
    if (!canManage || !photoUri || photoBusy) return;
    setPhotoBusy(true);
    const filePath = `${vehicle.id}/${Date.now()}-${photoUri.split('/').pop() ?? 'photo'}`;
    try {
      const normalizedUri = await normalizeImage(photoUri);
      const file = await new FileSystem.File(normalizedUri).bytes();
      const { error } = await supabase.storage
        .from('vehicle-documents')
        .upload(filePath, file, { upsert: false, contentType: 'image/jpeg' });
      if (error) throw error;
      const { data, error: insertError } = await supabase
        .from('vehicle_documents')
        .insert({
          vehicle_id: vehicle.id,
          document_type: 'Vehicle Photo',
          file_path: filePath,
          uploaded_by: userId,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      setPhotos((current) => {
        const nextPhoto = data as RecordRow;
        if (current.some((photo) => photo.id === nextPhoto.id || photo.file_path === nextPhoto.file_path)) {
          return current;
        }
        return [...current, nextPhoto];
      });
      setPhotoUri('');
      setPhotoPickerVisible(false);
      Alert.alert('Saved', 'Vehicle photo added.');
    } catch (e) {
      Alert.alert('Unable to upload photo', e instanceof Error ? e.message : 'Use a local file URI.');
    } finally {
      setPhotoBusy(false);
    }
  };
  const removePhoto = (photo: RecordRow) => {
    Alert.alert('Remove vehicle photo?', 'This removes only the vehicle photo, not compliance evidence.', [
      { text: 'Keep photo', style: 'cancel' },
      {
        text: 'Remove',
        onPress: () => {
          void (async () => {
            try {
              const filePath = String(photo.file_path);
              const { error: storageError } = await supabase.storage
                .from('vehicle-documents')
                .remove([filePath]);
              if (storageError) throw storageError;
              const { error: recordError } = await supabase
                .from('vehicle_documents')
                .delete()
                .eq('id', photo.id);
              if (recordError) throw recordError;
              setPhotos((current) => current.filter((item) => item.id !== photo.id));
            } catch (error) {
              Alert.alert(
                'Unable to remove vehicle photo',
                error instanceof Error ? error.message : 'Please try again.',
              );
            }
          })();
        },
      },
    ]);
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalPage, { backgroundColor: palette.bg }]}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={[styles.vehicleDetailTitle, { color: palette.text }]}>
              {vehicle.make} {vehicle.model}
            </Text>
            <Text style={styles.vehicleDetailPlate}>{vehicle.registration_number}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.panel}>
          <View style={styles.vehicleDetailMeta}>
            <Text style={styles.vehicleDetailIcon}>{vehicleIcon(vehicle.vehicle_type)}</Text>
            <Text style={{ color: palette.muted }}>
              {vehicle.vehicle_type} · {vehicle.status === 'active' ? 'Active' : 'Archived'}
            </Text>
          </View>
          <View style={styles.photoSection}>
            <View style={styles.detailSectionHeader}>
              <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Vehicle photos</Text>
              <View style={styles.photoHeaderActions}>
                <Text style={[styles.sectionHint, { color: palette.muted }]}>
                  {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                </Text>
                {canManage && (
                  <Pressable onPress={() => setPhotoPickerVisible(true)}>
                    <Text style={styles.addMoreLink}>Add</Text>
                  </Pressable>
                )}
              </View>
            </View>
            {photos.length ? (
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator
                contentContainerStyle={styles.photoGallery}
              >
                {photos.map((p) => (
                  <View key={p.id} style={styles.photoItem}>
                    <SignedContent path={String(p.file_path)} gallery />
                    {canManage && (
                      <Pressable
                        accessibilityLabel="Remove vehicle photo"
                        style={styles.photoRemoveButton}
                        onPress={() => removePhoto(p)}
                      >
                        <Text style={styles.photoRemoveIcon}>×</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.emptyPhoto, { backgroundColor: palette.card }]}>
              <Text style={{ color: palette.muted }}>No photos added yet.</Text>
              </View>
            )}
          </View>
          <View style={styles.dropdownWrap}>
            <Text style={[styles.fieldLabel, { color: palette.muted }]}>Vehicle records</Text>
            <Pressable
              style={[styles.dropdownButton, { backgroundColor: palette.card }]}
              onPress={() => setProfileSelectOpen(!profileSelectOpen)}
            >
              <Text style={{ color: palette.text }}>
                {{
                  overview: 'Overview',
                  mileage: 'Mileage history',
                  inspections: 'Inspection history',
                  maintenance: 'Maintenance history',
                  fuel: 'Refuelling history',
                  compliance: 'Compliance history',
                }[tab as 'overview' | 'mileage' | 'inspections' | 'maintenance' | 'fuel' | 'compliance']}
              </Text>
              <Text style={{ color: palette.muted }}>{profileSelectOpen ? '⌃' : '⌄'}</Text>
            </Pressable>
            {profileSelectOpen && (
              <View style={[styles.dropdownList, { backgroundColor: palette.card }]}>
                {[
                  ['overview', 'Overview'],
                  ['mileage', 'Mileage history'],
                  ['inspections', 'Inspection history'],
                  ['maintenance', 'Maintenance history'],
                  ['fuel', 'Refuelling history'],
                  ['compliance', 'Compliance history'],
                ].map(([value, label]) => (
                  <Pressable
                    key={value}
                    style={styles.dropdownOption}
                    onPress={() => {
                      setTab(value);
                      setProfileSelectOpen(false);
                    }}
                  >
                    <Text style={{ color: palette.text }}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          {tab === 'overview' && (
            <View style={[styles.detailCard, { backgroundColor: palette.card }]}>
              <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Vehicle details</Text>
              <Text style={{ color: palette.text }}>Year: {vehicle.manufacturing_year}</Text>
              <Text style={{ color: palette.muted }}>Department: {vehicle.department ?? '—'}</Text>
              <Text style={{ color: palette.muted }}>Driver: {vehicle.assigned_driver ?? '—'}</Text>
              <Text style={{ color: palette.muted }}>
                Energy: {vehicle.energy_type === 'electric' ? 'Electric' : 'Fuel'} · Fuel:{' '}
                {vehicle.fuel_type ?? '—'}
              </Text>
              <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Latest mileage</Text>
              <MileageRows rows={mileage.slice(0, 1)} palette={palette} />
              <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Latest inspection</Text>
              <InspectionRows rows={inspections.slice(0, 1)} palette={palette} />
              <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Latest maintenance</Text>
              <MaintenanceRows
                rows={maintenance.slice(0, 1)}
                attachments={maintenanceAttachments}
                palette={palette}
                onViewFile={setViewFile}
              />
              <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Latest refuelling</Text>
              {vehicle.energy_type === 'fuel' ? (
                <FuelRows rows={fuel.slice(0, 1)} palette={palette} onViewFile={setViewFile} />
              ) : (
                <Text style={{ color: palette.muted }}>Not applicable to electric vehicles.</Text>
              )}
              <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Latest compliance</Text>
              <ComplianceRows rows={compliance.slice(0, 1)} palette={palette} onViewFile={setViewFile} />
            </View>
          )}
          {tab === 'mileage' && <MileageRows rows={mileage} palette={palette} />}
          {tab === 'inspections' && <InspectionRows rows={inspections} palette={palette} />}
          {tab === 'maintenance' && (
            <MaintenanceRows
              rows={maintenance}
              attachments={maintenanceAttachments}
              palette={palette}
              onViewFile={setViewFile}
            />
          )}
          {tab === 'fuel' && <FuelRows rows={fuel} palette={palette} onViewFile={setViewFile} />}
          {tab === 'compliance' && (
            <ComplianceRows rows={compliance} palette={palette} onViewFile={setViewFile} />
          )}
          {canManage && (
            <Button
              title={vehicle.status === 'active' ? 'Archive vehicle' : 'Restore vehicle'}
              variant={vehicle.status === 'active' ? 'archive' : 'success'}
              onPress={() => void onToggleArchive()}
            />
          )}
        </ScrollView>
        <Modal
          visible={!!viewFile}
          transparent
          animationType="fade"
          onRequestClose={() => setViewFile(null)}
        >
          <View style={styles.overlay}>
            <View style={[styles.viewer, { backgroundColor: palette.card }]}>
              <Heading palette={palette}>Vehicle record attachment</Heading>
              {viewFile ? <SignedContent path={viewFile} /> : null}
            </View>
          </View>
        </Modal>
        <Modal
          visible={photoPickerVisible}
          animationType="slide"
          onRequestClose={() => setPhotoPickerVisible(false)}
        >
          <View style={[styles.modalPage, { backgroundColor: palette.bg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Add vehicle photo</Text>
            </View>
            <View style={styles.panel}>
              <Pressable
                style={[styles.attachmentBox, { borderColor: colors.border }]}
                onPress={() => void choosePhoto().then((uri) => uri && setPhotoUri(uri))}
              >
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.attachmentPreview} />
                ) : (
                  <Text style={styles.attachmentPlaceholder}>Upload vehicle photo</Text>
                )}
              </Pressable>
              <Button
                title="Save vehicle photo"
                variant="secondary"
                disabled={!photoUri || photoBusy}
                onPress={() => void addPhoto()}
              />
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}
function Rows({
  rows,
  palette,
  fileKey,
  onViewFile,
}: {
  rows: RecordRow[];
  palette: { card: string; text: string; muted: string };
  fileKey?: string;
  onViewFile?: (path: string) => void;
}) {
  return rows.length ? (
    <>
      {rows.map((r) => (
        <View key={r.id} style={[styles.card, { backgroundColor: palette.card }]}>
          {Object.entries(r)
            .filter(([k]) => !['id', 'vehicle_id'].includes(k))
            .filter(([k]) => k !== fileKey)
            .slice(0, 6)
            .map(([k, v]) => (
              <Text key={k} style={{ color: palette.muted }}>
                {k.replaceAll('_', ' ')}: {String(v ?? '—')}
              </Text>
            ))}
          {fileKey && r[fileKey] && onViewFile ? (
            <Button
              title="View attachment"
              variant="secondary"
              onPress={() => onViewFile(String(r[fileKey]))}
            />
          ) : null}
        </View>
      ))}
    </>
  ) : (
    <Text style={{ color: palette.muted }}>No records yet.</Text>
  );
}

function MileageRows({
  rows,
  palette,
}: {
  rows: RecordRow[];
  palette: { card: string; text: string; muted: string };
}) {
  return rows.length ? (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={[styles.tableCard, { backgroundColor: palette.card }]}>
        <View style={styles.tableRow}>
          <Text style={[styles.tableHeaderCell, styles.tableDateCell, { color: palette.text }]}>Date</Text>
          <Text style={[styles.tableHeaderCell, styles.tableValueCell, { color: palette.text }]}>Mileage</Text>
          <Text style={[styles.tableHeaderCell, styles.tableRemarksCell, { color: palette.text }]}>Remarks</Text>
        </View>
        {rows.map((row) => (
          <View key={row.id} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableDateCell, { color: palette.muted }]}>
              {String(row.reading_date)}
            </Text>
            <Text style={[styles.tableCell, styles.tableValueCell, { color: palette.muted }]}>
              {String(row.odometer_reading)} km
            </Text>
            <Text style={[styles.tableCell, styles.tableRemarksCell, { color: palette.muted }]}>
              {String(row.notes ?? '—')}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  ) : (
    <Text style={{ color: palette.muted }}>No mileage records yet.</Text>
  );
}

function InspectionRows({
  rows,
  palette,
}: {
  rows: RecordRow[];
  palette: { card: string; text: string; muted: string };
}) {
  return rows.length ? (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={[styles.tableCard, { backgroundColor: palette.card }]}>
        <View style={styles.tableRow}>
          <Text style={[styles.tableHeaderCell, styles.tableDateCell, { color: palette.text }]}>Date</Text>
          <Text style={[styles.tableHeaderCell, styles.tableValueCell, { color: palette.text }]}>Odometer</Text>
          <Text style={[styles.tableHeaderCell, styles.tableConditionCell, { color: palette.text }]}>Condition</Text>
          <Text style={[styles.tableHeaderCell, styles.tableRemarksCell, { color: palette.text }]}>Remarks</Text>
        </View>
        {rows.map((row) => (
          <View key={row.id} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableDateCell, { color: palette.muted }]}>
              {String(row.inspection_date)}
            </Text>
            <Text style={[styles.tableCell, styles.tableValueCell, { color: palette.muted }]}>
              {String(row.odometer_reading)} km
            </Text>
            <Text style={[styles.tableCell, styles.tableConditionCell, { color: palette.muted }]}>
              {String(row.overall_condition ?? '—')}
            </Text>
            <Text style={[styles.tableCell, styles.tableRemarksCell, { color: palette.muted }]}>
              {String(row.remarks ?? '—')}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  ) : (
    <Text style={{ color: palette.muted }}>No inspection records yet.</Text>
  );
}

function FuelRows({
  rows,
  palette,
  onViewFile,
}: {
  rows: RecordRow[];
  palette: { card: string; text: string; muted: string };
  onViewFile: (path: string) => void;
}) {
  return rows.length ? (
    <>
      {rows.map((row) => (
        <View key={row.id} style={[styles.card, { backgroundColor: palette.card }]}>
          <Text style={{ color: palette.text }}>
            {String(row.refuel_date)} · {String(row.fuel_type)}
          </Text>
          <Text style={{ color: palette.muted }}>
            Quantity: {String(row.litres)} L · Cost/L: LKR {String(row.cost_per_litre)} · Total: LKR{' '}
            {String(row.total_cost)}
          </Text>
          <Text style={{ color: palette.muted }}>
            Odometer: {row.odometer_reading == null ? '—' : `${String(row.odometer_reading)} km`}
          </Text>
          <Text style={{ color: palette.muted }}>
            Station: {String(row.fuel_station ?? '—')}
          </Text>
          {row.notes ? <Text style={{ color: palette.muted }}>Notes: {String(row.notes)}</Text> : null}
          {row.receipt_path ? (
            <Button
              title="View fuel receipt"
              variant="secondary"
              onPress={() => onViewFile(String(row.receipt_path))}
            />
          ) : (
            <Text style={{ color: palette.muted }}>No receipt attached.</Text>
          )}
        </View>
      ))}
    </>
  ) : (
    <Text style={{ color: palette.muted }}>No fuel records yet.</Text>
  );
}

function ComplianceRows({
  rows,
  palette,
  onViewFile,
}: {
  rows: RecordRow[];
  palette: { card: string; text: string; muted: string };
  onViewFile: (path: string) => void;
}) {
  return rows.length ? (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={[styles.tableCard, styles.complianceTableCard, { backgroundColor: palette.card }]}>
        <View style={styles.tableRow}>
          {[
            { label: 'Certificate', style: styles.tableComplianceTypeCell },
            { label: 'From', style: styles.tableDateCell },
            { label: 'To', style: styles.tableDateCell },
            { label: 'Reference', style: styles.tableComplianceReferenceCell },
            { label: 'Status', style: styles.tableComplianceStatusCell },
          ].map(({ label, style }) => (
            <Text key={label} style={[styles.tableHeaderCell, style, { color: palette.text }]}>
              {label}
            </Text>
          ))}
        </View>
        {rows.map((row) => (
          <View key={row.id} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableComplianceTypeCell, { color: palette.muted }]}>
              {String(row.compliance_type)}
            </Text>
            <Text style={[styles.tableCell, styles.tableDateCell, { color: palette.muted }]}>
              {String(row.issue_date ?? '—')}
            </Text>
            <Text style={[styles.tableCell, styles.tableDateCell, { color: palette.muted }]}>
              {String(row.expiry_date ?? '—')}
            </Text>
            <Text style={[styles.tableCell, styles.tableComplianceReferenceCell, { color: palette.muted }]}>
              {String(row.reference_number ?? '—')}
            </Text>
            <View style={styles.tableComplianceStatusCell}>
              <Text style={[styles.tableCell, { color: palette.muted }]}>{String(row.status)}</Text>
              {row.file_path ? (
                <Pressable onPress={() => onViewFile(String(row.file_path))}>
                  <Text style={styles.addMoreLink}>View</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  ) : (
    <Text style={{ color: palette.muted }}>No compliance records yet.</Text>
  );
}

function MaintenanceRows({
  rows,
  attachments,
  palette,
  onViewFile,
}: {
  rows: RecordRow[];
  attachments: RecordRow[];
  palette: { card: string; text: string; muted: string };
  onViewFile: (path: string) => void;
}) {
  return rows.length ? (
    <>
      {rows.map((row) => {
        const rowAttachments = attachments.filter(
          (attachment) => attachment.maintenance_record_id === row.id,
        );
        return (
          <View key={row.id} style={[styles.card, { backgroundColor: palette.card }]}>
            <Text style={{ color: palette.text }}>
              {String(row.service_date)} · {String(row.service_type)}
            </Text>
            <Text style={{ color: palette.muted }}>
              Sent: {String(row.handover_date ?? '—')} · Returned:{' '}
              {String(row.retrieval_date ?? 'Pending')}
            </Text>
            <Text style={{ color: palette.muted }}>
              {String(row.service_station ?? 'No station')} · {String(row.description ?? 'No repair description')}
            </Text>
            <Text style={{ color: palette.muted }}>
              Odometer: {row.odometer_reading == null ? '—' : `${String(row.odometer_reading)} km`} ·
              Cost: LKR {String(row.cost ?? '0.00')}
            </Text>
            {rowAttachments.length ? (
              rowAttachments.map((attachment) => (
                <Button
                  key={attachment.id}
                  title={
                    attachment.attachment_type
                      ? `View ${String(attachment.attachment_type).toLowerCase()}`
                      : 'View attachment'
                  }
                  variant="secondary"
                  onPress={() => onViewFile(String(attachment.file_path))}
                />
              ))
            ) : (
              <Text style={{ color: palette.muted }}>No invoice or receipt attached.</Text>
            )}
          </View>
        );
      })}
    </>
  ) : (
    <Text style={{ color: palette.muted }}>No records yet.</Text>
  );
}
type ReportKind = 'compliance' | 'maintenance' | 'fuel';
type ReportValue = string | number | null;
type ReportRow = Record<string, ReportValue>;
type ReportColumn = { key: string; label: string };

function csvValue(value: ReportValue) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function reportHtml(title: string, columns: ReportColumn[], rows: ReportRow[]) {
  const headers = columns.map((column) => `<th>${column.label}</th>`).join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${columns.map((column) => `<td>${String(row[column.key] ?? '—')}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style>
    body { font-family: Arial, sans-serif; color: #102a43; padding: 18px; }
    h1 { font-size: 20px; } table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d9e2ec; padding: 8px; text-align: left; font-size: 11px; }
    th { background: #e8eef7; font-weight: bold; }
  </style></head><body><h1>${title}</h1><table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

function Reports({
  vehicles,
  palette,
}: {
  vehicles: VehicleRecord[];
  palette: { bg: string; card: string; text: string; muted: string };
}) {
  const [kind, setKind] = useState<ReportKind>('compliance');
  const [kindOpen, setKindOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [startDate, setStartDate] = useState(formatDate(new Date(Date.now() - 30 * 86400000)));
  const [endDate, setEndDate] = useState(formatDate(new Date()));
  const [columns, setColumns] = useState<ReportColumn[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const reportTitle =
    kind === 'compliance'
      ? 'Latest compliance certificates by vehicle'
      : kind === 'maintenance'
        ? `Maintenance history${selectedVehicle ? ` · ${selectedVehicle.registration_number}` : ''}`
        : 'Refuelling statistics by vehicle and period';

  const generate = async () => {
    if (startDate > endDate) {
      Alert.alert('Invalid date range', 'The start date cannot be after the end date.');
      return;
    }
    if (kind === 'maintenance' && !vehicleId) {
      Alert.alert('Vehicle required', 'Select a vehicle for the maintenance history report.');
      return;
    }
    setBusy(true);
    try {
      if (kind === 'compliance') {
        const { data, error } = await supabase
          .from('compliance_records')
          .select('vehicle_id, compliance_type, issue_date, expiry_date, reference_number, status, updated_at, created_at')
          .order('updated_at', { ascending: false });
        if (error) throw error;
        const latest = new Map<string, Record<string, unknown>>();
        const orderedCompliance = [...(data ?? [])].sort((a, b) =>
          String(b.updated_at ?? b.created_at ?? '').localeCompare(
            String(a.updated_at ?? a.created_at ?? ''),
          ),
        );
        for (const record of orderedCompliance) {
          const key = `${record.vehicle_id}:${record.compliance_type}`;
          if (!latest.has(key)) latest.set(key, record);
        }
        const reportRows = vehicles.flatMap((vehicle) => {
          const byType = (type: string) => latest.get(`${vehicle.id}:${type}`);
          const revenue = byType('Revenue Licence');
          const emission = byType('Emission Test');
          const insurance = byType('Insurance');
          return [
            {
              registration: vehicle.registration_number,
              vehicle: `${vehicle.make} ${vehicle.model}`,
              revenue_duration: revenue
                ? `${String(revenue.issue_date ?? '—')} - ${String(revenue.expiry_date ?? '—')}`
                : '—',
              emission_duration: emission
                ? `${String(emission.issue_date ?? '—')} - ${String(emission.expiry_date ?? '—')}`
                : '—',
              insurance_duration: insurance
                ? `${String(insurance.issue_date ?? '—')} - ${String(insurance.expiry_date ?? '—')}`
                : '—',
            },
          ];
        });
        setColumns([
          { key: 'registration', label: 'Registration' },
          { key: 'vehicle', label: 'Vehicle' },
          { key: 'revenue_duration', label: 'Revenue licence duration' },
          { key: 'emission_duration', label: 'Emission test duration' },
          { key: 'insurance_duration', label: 'Insurance duration' },
        ]);
        setRows(reportRows);
      } else if (kind === 'maintenance') {
        const { data, error } = await supabase
          .from('maintenance_records')
          .select('service_date, handover_date, retrieval_date, odometer_reading, service_type, description, service_station, cost')
          .eq('vehicle_id', vehicleId)
          .order('service_date', { ascending: false });
        if (error) throw error;
        setColumns([
          { key: 'service_date', label: 'Service date' },
          { key: 'handover_date', label: 'Sent to service' },
          { key: 'retrieval_date', label: 'Returned from service' },
          { key: 'odometer', label: 'Odometer (km)' },
          { key: 'service_type', label: 'Service type' },
          { key: 'description', label: 'Repair description' },
          { key: 'station', label: 'Service station' },
          { key: 'cost', label: 'Cost (LKR)' },
        ]);
        setRows(
          (data ?? []).map((record) => ({
            service_date: record.service_date,
            handover_date: record.handover_date,
            retrieval_date: record.retrieval_date,
            odometer: record.odometer_reading,
            service_type: record.service_type,
            description: record.description,
            station: record.service_station,
            cost: record.cost,
          })),
        );
      } else {
        const { data, error } = await supabase
          .from('fuel_records')
          .select('vehicle_id, refuel_date, fuel_type, litres, cost_per_litre, total_cost')
          .gte('refuel_date', startDate)
          .lte('refuel_date', endDate);
        if (error) throw error;
        const stats = new Map<string, { events: number; litres: number; cost: number }>();
        for (const record of data ?? []) {
          const current = stats.get(record.vehicle_id) ?? { events: 0, litres: 0, cost: 0 };
          current.events += 1;
          current.litres += Number(record.litres ?? 0);
          current.cost += Number(record.total_cost ?? 0);
          stats.set(record.vehicle_id, current);
        }
        setColumns([
          { key: 'registration', label: 'Registration' },
          { key: 'vehicle', label: 'Vehicle' },
          { key: 'events', label: 'Refuelling events' },
          { key: 'litres', label: 'Total litres' },
          { key: 'cost', label: 'Total cost (LKR)' },
          { key: 'average', label: 'Average cost/L (LKR)' },
        ]);
        setRows(
          vehicles.map((vehicle) => {
            const stat = stats.get(vehicle.id) ?? { events: 0, litres: 0, cost: 0 };
            return {
              registration: vehicle.registration_number,
              vehicle: `${vehicle.make} ${vehicle.model}`,
              events: stat.events,
              litres: stat.litres.toFixed(3),
              cost: stat.cost.toFixed(2),
              average: stat.litres ? (stat.cost / stat.litres).toFixed(2) : '—',
            };
          }),
        );
      }
    } catch (error) {
      Alert.alert('Unable to generate report', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    if (!rows.length) return;
    const csv = [
      columns.map((column) => csvValue(column.label)).join(','),
      ...rows.map((row) => columns.map((column) => csvValue(row[column.key])).join(',')),
    ].join('\n');
    try {
      const file = new FileSystem.File(
        FileSystem.Paths.document,
        `riyon-${kind}-report-${Date.now()}.csv`,
      );
      await file.write(csv);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('CSV ready', `The CSV file was created at ${file.uri}.`);
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export CSV report' });
    } catch (error) {
      Alert.alert('Unable to export CSV', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const exportPdf = async () => {
    if (!rows.length) return;
    try {
      const { base64 } = await Print.printToFileAsync({
        html: reportHtml(reportTitle, columns, rows),
        base64: true,
      });
      if (!base64 || !LegacyFileSystem.documentDirectory) {
        throw new Error('The PDF could not be saved to app storage.');
      }
      const fileUri = `${LegacyFileSystem.documentDirectory}riyon-${kind}-report-${Date.now()}.pdf`;
      await LegacyFileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: LegacyFileSystem.EncodingType.Base64,
      });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('PDF ready', `The PDF file was created at ${fileUri}.`);
        return;
      }
      try {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Export PDF report',
        });
      } catch (shareError) {
        if (Platform.OS !== 'android') throw shareError;
        const contentUri = await LegacyFileSystem.getContentUriAsync(fileUri);
        await Sharing.shareAsync(contentUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Export PDF report',
        });
      }
    } catch (error) {
      Alert.alert('Unable to export PDF', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <Panel>
      <Heading palette={palette}>Fleet reports</Heading>
      <Text style={{ color: palette.muted }}>
        Choose a report, set the period where applicable, preview the indexed table, and export it.
      </Text>
      <View style={styles.dropdownWrap}>
        <Text style={[styles.fieldLabel, { color: palette.muted }]}>Report type</Text>
        <Pressable
          style={[styles.dropdownButton, { backgroundColor: palette.card }]}
          onPress={() => setKindOpen(!kindOpen)}
        >
          <Text style={{ color: palette.text }}>{reportTitle}</Text>
          <Text style={{ color: palette.muted }}>{kindOpen ? '⌃' : '⌄'}</Text>
        </Pressable>
        {kindOpen && (
          <View style={[styles.dropdownList, { backgroundColor: palette.card }]}>
            {[
              ['compliance', 'Latest compliance summary'],
              ['maintenance', 'Maintenance history per vehicle'],
              ['fuel', 'Refuelling statistics for all vehicles'],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                style={styles.dropdownOption}
                onPress={() => {
                  setKind(value as ReportKind);
                  setKindOpen(false);
                  setRows([]);
                }}
              >
                <Text style={{ color: palette.text }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {kind === 'maintenance' && (
        <View style={styles.dropdownWrap}>
          <Text style={[styles.fieldLabel, { color: palette.muted }]}>Vehicle</Text>
          <Pressable
            style={[styles.dropdownButton, { backgroundColor: palette.card }]}
            onPress={() => setVehicleOpen(!vehicleOpen)}
          >
            <Text style={{ color: selectedVehicle ? palette.text : palette.muted }}>
              {selectedVehicle
                ? `${selectedVehicle.make} ${selectedVehicle.model} · ${selectedVehicle.registration_number}`
                : 'Select a vehicle'}
            </Text>
            <Text style={{ color: palette.muted }}>{vehicleOpen ? '⌃' : '⌄'}</Text>
          </Pressable>
          {vehicleOpen && (
            <View style={[styles.dropdownList, { backgroundColor: palette.card }]}>
              {vehicles.map((vehicle) => (
                <Pressable
                  key={vehicle.id}
                  style={styles.dropdownOption}
                  onPress={() => {
                    setVehicleId(vehicle.id);
                    setVehicleOpen(false);
                  }}
                >
                  <Text style={{ color: palette.text }}>
                    {vehicle.registration_number} · {vehicle.make} {vehicle.model}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
      {kind === 'fuel' && (
        <View style={styles.reportDateRow}>
          <View style={styles.reportDateField}>
            <DatePickerField label="From" value={startDate} onChange={setStartDate} palette={palette} />
          </View>
          <View style={styles.reportDateField}>
            <DatePickerField label="To" value={endDate} onChange={setEndDate} palette={palette} />
          </View>
        </View>
      )}
      <Button
        title={busy ? 'Generating...' : 'Generate report'}
        variant="success"
        disabled={busy}
        onPress={() => void generate()}
      />
      {rows.length ? (
        <>
          <ReportTable columns={columns} rows={rows} palette={palette} />
          <View style={styles.recordActions}>
            <Button title="Export CSV" variant="secondary" onPress={() => void exportCsv()} />
            <Button title="Export PDF" variant="success" onPress={() => void exportPdf()} />
          </View>
        </>
      ) : null}
    </Panel>
  );
}

function ReportTable({
  columns,
  rows,
  palette,
}: {
  columns: ReportColumn[];
  rows: ReportRow[];
  palette: { card: string; text: string; muted: string };
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={[styles.tableCard, styles.reportTableCard, { backgroundColor: palette.card }]}>
        <View style={styles.tableRow}>
          {columns.map((column) => (
            <Text key={column.key} style={[styles.reportTableHeader, { color: palette.text }]}>
              {column.label}
            </Text>
          ))}
        </View>
        {rows.map((row, index) => (
          <View key={String(row.registration ?? row.service_date ?? index)} style={styles.tableRow}>
            {columns.map((column) => (
              <Text key={column.key} style={[styles.reportTableCell, { color: palette.muted }]}>
                {String(row[column.key] ?? '—')}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingTop: 52, paddingBottom: 30 },
  centered: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  headerCopy: { flex: 1 },
  logo: { height: 75, width: 110 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontSize: 25, fontWeight: '800', marginTop: 4 },
  subtitle: { fontSize: 15, marginTop: 5 },
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  role: { fontWeight: '700', textTransform: 'capitalize' },
  dashboardTopbar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dashboardLogo: { height: 52, width: 118 },
  topbarActions: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  roleBadge: {
    backgroundColor: '#e8eefb',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 9,
    paddingVertical: 6,
    textTransform: 'capitalize',
  },
  themeToggle: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  themeSymbol: { fontSize: 20, lineHeight: 24 },
  searchInput: {
    borderColor: '#e1e8f2',
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 14,
    marginTop: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  welcomeBlock: { marginBottom: 16, marginTop: 22 },
  welcomeTitle: { fontSize: 28, fontWeight: '900' },
  statGrid: { flexDirection: 'row', gap: 9, marginBottom: 14 },
  statCard: {
    borderColor: '#e1e8f2',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minHeight: 132,
    padding: 12,
  },
  statIcon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    marginBottom: 10,
    width: 34,
  },
  statIconText: { color: colors.navy, fontSize: 17, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '700' },
  statValue: { fontSize: 27, fontWeight: '900', marginTop: 4 },
  complianceCard: { borderRadius: 17, marginBottom: 21, padding: 17 },
  complianceHeader: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  complianceIcon: {
    backgroundColor: '#33c477',
    borderRadius: 12,
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    overflow: 'hidden',
    padding: 5,
  },
  complianceTitle: { color: '#fff', flex: 1, fontSize: 16, fontWeight: '800' },
  complianceLink: { color: '#a9c5ff', fontSize: 12, fontWeight: '700' },
  complianceDescription: { color: '#cfdbf4', fontSize: 12, lineHeight: 18, marginTop: 13 },
  progressTrack: {
    backgroundColor: '#304d83',
    borderRadius: 4,
    height: 7,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: { backgroundColor: '#38d486', borderRadius: 4, height: '100%' },
  progressLabel: { color: '#dce7ff', fontSize: 11, marginTop: 8 },
  sectionHeading: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 19, fontWeight: '900' },
  sectionHint: { fontSize: 12, fontWeight: '600' },
  tiles: { gap: 10 },
  tile: {
    borderColor: '#e1e8f2',
    borderRadius: 15,
    borderWidth: 1,
    elevation: 2,
    minHeight: 145,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  tileTopline: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  tileIcon: { fontSize: 24 },
  tileNumber: { color: colors.red, fontWeight: '800' },
  tileTitle: { fontSize: 18, fontWeight: '800', marginTop: 11 },
  tileText: { fontSize: 14, marginTop: 5 },
  tileArrow: { color: '#2870d8', fontSize: 12, fontWeight: '800', marginTop: 12 },
  signOut: {
    alignSelf: 'center',
    borderColor: colors.border,
    borderRadius: 9,
    borderWidth: 1,
    marginTop: 22,
    padding: 12,
    paddingHorizontal: 30,
  },
  signOutText: { color: colors.navy, fontWeight: '700' },
  footer: { alignSelf: 'center', fontSize: 12, marginTop: 18 },
  modalPage: { flex: 1, paddingTop: 48 },
  modalHeader: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 18,
  },
  modalTitle: { fontSize: 22, fontWeight: '800' },
  close: { color: colors.red, fontWeight: '700' },
  panel: { gap: 12, padding: 18, paddingBottom: 50 },
  heading: { fontSize: 21, fontWeight: '800', marginBottom: 4 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  listToggle: {
    backgroundColor: '#e8eef7',
    borderRadius: 10,
    flexDirection: 'row',
    marginBottom: 4,
    padding: 3,
  },
  listToggleButton: {
    borderRadius: 8,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  listToggleActive: { backgroundColor: '#9aa5b1' },
  card: { borderRadius: 12, gap: 5, padding: 14 },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  vehicleListHeader: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  vehicleTypeIcon: { fontSize: 28, width: 35 },
  vehicleListCopy: { flex: 1 },
  plate: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8eef7',
    borderRadius: 4,
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  vehicleActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  fleetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterField: { flex: 1 },
  vehicleCardTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  vehicleStatus: { borderRadius: 12, fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  vehicleStatusAttention: { backgroundColor: '#fde2e1', color: colors.red },
  vehicleStatusDue: { backgroundColor: '#fff0d4', color: '#8a5a00' },
  vehicleStatusActive: { backgroundColor: '#d9f7e7', color: '#16875a' },
  vehicleDueRow: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: 12, paddingTop: 11 },
  vehicleDetailTitle: { fontSize: 20, fontWeight: '900' },
  vehicleDetailPlate: {
    backgroundColor: '#fff2cc',
    borderRadius: 5,
    color: '#765500',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  vehicleDetailMeta: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  vehicleDetailIcon: { fontSize: 23 },
  detailSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  photoHeaderActions: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  addMoreLink: { color: '#2870d8', fontSize: 13, fontWeight: '800' },
  detailSectionTitle: { fontSize: 16, fontWeight: '800' },
  photoSection: { gap: 4 },
  photoGallery: { gap: 10 },
  photoItem: { position: 'relative', width: 280 },
  photoRemoveButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 3,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 7,
    top: 7,
    width: 24,
  },
  photoRemoveIcon: { color: colors.red, fontSize: 22, fontWeight: '800', lineHeight: 22 },
  emptyPhoto: { alignItems: 'center', borderRadius: 12, padding: 28 },
  photoUploadCard: { borderRadius: 12, gap: 8, padding: 12 },
  detailCard: { borderRadius: 12, gap: 8, padding: 14 },
  operationsIntro: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 5 },
  dateButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    padding: 11,
  },
  dropdownWrap: { position: 'relative', zIndex: 2 },
  dropdownButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 13,
  },
  dropdownList: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    elevation: 4,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
  },
  dropdownOption: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  updateChoiceRow: { flexDirection: 'row', gap: 9, zIndex: 1 },
  updateChoice: {
    backgroundColor: '#eef3fa',
    borderColor: '#dce5f1',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  updateChoiceMileage: { backgroundColor: '#2367c8', borderColor: '#2367c8' },
  updateChoiceInspection: { backgroundColor: '#16875a', borderColor: '#16875a' },
  updateChoiceIcon: { fontSize: 22, marginBottom: 4 },
  updateChoiceTitle: { fontSize: 14, fontWeight: '900' },
  updateForm: { borderRadius: 13, gap: 10, padding: 14, zIndex: 1 },
  attachmentBox: {
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 118,
    overflow: 'hidden',
    padding: 8,
  },
  attachmentPicker: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  attachmentGallery: { gap: 8 },
  attachmentThumbnail: { borderRadius: 8, height: 92, width: 92 },
  attachmentPreview: { borderRadius: 10, height: 102, width: '100%' },
  attachmentAddTile: {
    alignItems: 'center',
    backgroundColor: '#eef3fa',
    borderRadius: 8,
    height: 92,
    justifyContent: 'center',
    width: 92,
  },
  attachmentAddText: { color: colors.navy, fontSize: 32, fontWeight: '300' },
  attachmentPlaceholder: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  historyHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
  },
  historyCard: { borderLeftColor: colors.red, borderLeftWidth: 4, borderRadius: 10, gap: 4, padding: 12 },
  historyRecordCard: { borderRadius: 12, gap: 8, padding: 15 },
  historyRecordTitle: { fontSize: 17, fontWeight: '800' },
  recordActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyValue: { fontSize: 16, fontWeight: '900' },
  totalCostBox: { borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  fuelHistorySection: { gap: 8 },
  tableCard: { borderRadius: 12, minWidth: 520, overflow: 'hidden', padding: 10 },
  fuelTableCard: { minWidth: 830 },
  complianceTableCard: { minWidth: 680 },
  tableRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 11,
  },
  tableHeaderCell: { fontSize: 12, fontWeight: '900' },
  tableCell: { fontSize: 13 },
  tableDateCell: { width: 105 },
  tableValueCell: { width: 105 },
  tableConditionCell: { width: 115 },
  tableRemarksCell: { flex: 1, minWidth: 150 },
  tableFuelTypeCell: { width: 100 },
  tableFuelNumberCell: { width: 105 },
  tableFuelStationCell: { width: 130 },
  tableComplianceTypeCell: { width: 140 },
  tableComplianceReferenceCell: { width: 130 },
  tableComplianceStatusCell: { width: 120 },
  reportDateRow: { flexDirection: 'row', gap: 8 },
  reportDateField: { flex: 1 },
  reportTableCard: { minWidth: 900 },
  reportTableHeader: { fontSize: 12, fontWeight: '900', minWidth: 120, paddingHorizontal: 8 },
  reportTableCell: { fontSize: 12, minWidth: 120, paddingHorizontal: 8 },
  form: { borderRadius: 12, gap: 10, padding: 14 },
  input: { borderRadius: 8, borderWidth: 1, fontSize: 15, padding: 11 },
  button: { backgroundColor: colors.red, borderRadius: 8, marginVertical: 3, padding: 11 },
  buttonSecondary: { backgroundColor: '#2367c8' },
  buttonSuccess: { backgroundColor: '#16875a' },
  buttonArchive: { backgroundColor: '#6b7280' },
  buttonText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  picker: { borderRadius: 8, padding: 9 },
  loginCard: { borderRadius: 16, gap: 12, marginTop: 28, padding: 20, width: '100%' },
  error: { color: colors.red, fontSize: 14 },
  overlay: {
    alignItems: 'center',
    backgroundColor: '#0009',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  viewer: { borderRadius: 14, gap: 12, maxHeight: '90%', padding: 18, width: '100%' },
  documentImage: { height: 240, width: '100%' },
  galleryImage: { borderRadius: 12, height: 210, width: 280 },
  report: { fontFamily: 'monospace', padding: 12 },
});
