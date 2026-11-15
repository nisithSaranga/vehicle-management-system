import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import {
  Alert,
  Image,
  Modal,
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
type Section = 'fleet' | 'operations' | 'compliance' | 'maintenance' | 'reports';
type RecordRow = Record<string, unknown> & { id: string; vehicle_id: string };
const colors = { red: '#b42318', navy: '#102a43', muted: '#52606d', border: '#d9e2ec' };

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
        'id, registration_number, make, model, vehicle_type, manufacturing_year, department, assigned_driver, fuel_type, status',
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
            Welcome, {profile.full_name.split(' ')[0]}!
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
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>
              {sectionTitle(section)}
            </Text>
            <Pressable onPress={() => setSection(null)}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          {section === 'fleet' && (
            <Fleet
              vehicles={vehicles}
              canManage={!!canManage}
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
            <Maintenance vehicles={vehicles} canManage={!!canManage} palette={palette} />
          )}
          {section === 'reports' && <Reports vehicles={vehicles} palette={palette} />}
        </View>
      </Modal>
      <VehicleProfile
        vehicle={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
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
  palette: { card: string; text: string; muted: string };
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
    reports: 'Reports',
  }[section ?? 'fleet'];
}
function vehicleIcon(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes('bike') || normalized.includes('scooty')) return '🏍';
  if (normalized.includes('forklift')) return '🏗';
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
function Button({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[styles.button, disabled && { opacity: 0.6 }]}
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
  onRefresh,
  onSelect,
  palette,
}: {
  vehicles: VehicleRecord[];
  canManage: boolean;
  onRefresh: () => Promise<void>;
  onSelect: (v: VehicleRecord) => void;
  palette: { card: string; text: string; muted: string };
}) {
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const changeStatus = async (v: VehicleRecord) => {
    setBusy(true);
    const { error } = await supabase
      .from('vehicles')
      .update({ status: v.status === 'active' ? 'archived' : 'active' })
      .eq('id', v.id);
    if (error) Alert.alert('Unable to update vehicle', error.message);
    else await onRefresh();
    setBusy(false);
  };
  const deleteVehicle = async (v: VehicleRecord) => {
    if (!canManage) return;
    Alert.alert(
      'Delete vehicle permanently?',
      `${v.make} ${v.model} (${v.registration_number}) and all related records will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const [{ data: documents }, { data: compliance }, { data: maintenance }] =
              await Promise.all([
                supabase
                  .from('vehicle_documents')
                  .select('file_path')
                  .eq('vehicle_id', v.id),
                supabase
                  .from('compliance_records')
                  .select('file_path')
                  .eq('vehicle_id', v.id),
                supabase
                  .from('maintenance_records')
                  .select('document_path')
                  .eq('vehicle_id', v.id),
              ]);
            const paths = [
              ...(documents ?? []).map((document) => document.file_path),
              ...(compliance ?? []).map((record) => record.file_path),
              ...(maintenance ?? []).map((record) => record.document_path),
            ].filter((path): path is string => !!path);
            if (paths.length) await supabase.storage.from('vehicle-documents').remove(paths);
            const dependentTables = [
              'reminder_logs',
              'notifications',
              'vehicle_documents',
              'mileage_records',
              'maintenance_records',
              'compliance_records',
              'inspections',
            ] as const;
            for (const table of dependentTables) {
              const { error } = await supabase.from(table).delete().eq('vehicle_id', v.id);
              if (error) {
                Alert.alert('Unable to delete vehicle', error.message);
                setBusy(false);
                return;
              }
            }
            const { error } = await supabase.from('vehicles').delete().eq('id', v.id);
            if (error) Alert.alert('Unable to delete vehicle', error.message);
            else await onRefresh();
            setBusy(false);
          },
        },
      ],
    );
  };
  const visibleVehicles = vehicles.filter((v) =>
    showArchived ? v.status !== 'active' : v.status === 'active',
  );
  return (
    <Panel>
      <View style={styles.row}>
        <Heading palette={palette}>Fleet vehicles</Heading>
        {canManage && (
          <Button
            title={showForm ? 'Close' : 'Add vehicle'}
            onPress={() => setShowForm(!showForm)}
          />
        )}
      </View>
      <View style={styles.listToggle}>
        <Pressable
          style={[styles.listToggleButton, !showArchived && styles.listToggleActive]}
          onPress={() => setShowArchived(false)}
        >
          <Text style={{ color: !showArchived ? '#fff' : palette.muted }}>Active vehicles</Text>
        </Pressable>
        <Pressable
          style={[styles.listToggleButton, showArchived && styles.listToggleActive]}
          onPress={() => setShowArchived(true)}
        >
          <Text style={{ color: showArchived ? '#fff' : palette.muted }}>Archive list</Text>
        </Pressable>
      </View>
      {showForm && (
        <VehicleForm
          onSaved={() => {
            setShowForm(false);
            void onRefresh();
          }}
          palette={palette}
        />
      )}
      {visibleVehicles.length === 0 ? (
        <Text style={{ color: palette.muted }}>
          {showArchived ? 'No archived vehicles.' : 'No active vehicles have been registered yet.'}
        </Text>
      ) : (
        visibleVehicles.map((v) => (
          <View key={v.id} style={[styles.card, { backgroundColor: palette.card }]}>
            <View style={styles.vehicleListHeader}>
              <Text style={styles.vehicleTypeIcon}>{vehicleIcon(v.vehicle_type)}</Text>
              <View style={styles.vehicleListCopy}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  {v.make} {v.model}
                </Text>
                <Text style={styles.plate}>{v.registration_number}</Text>
                <Text style={{ color: palette.muted }}>
                  {v.vehicle_type} · {v.department ?? 'No department'}
                </Text>
              </View>
            </View>
            <View style={styles.vehicleActions}>
              <Button title="View" onPress={() => onSelect(v)} />
              {canManage && (
                <Button
                  title={v.status === 'active' ? 'Archive' : 'Restore'}
                  disabled={busy}
                  onPress={() => void changeStatus(v)}
                />
              )}
              {canManage && v.status !== 'active' && (
                <Button
                  title="Delete"
                  disabled={busy}
                  onPress={() => void deleteVehicle(v)}
                />
              )}
            </View>
          </View>
        ))
      )}
    </Panel>
  );
}
function VehicleForm({
  onSaved,
  palette,
}: {
  onSaved: () => void;
  palette: { text: string; card: string };
}) {
  const [form, setForm] = useState({
    registration_number: '',
    make: '',
    model: '',
    vehicle_type: '',
    manufacturing_year: String(new Date().getFullYear()),
    department: '',
    assigned_driver: '',
    fuel_type: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const save = async () => {
    if (!form.registration_number || !form.make || !form.model || !form.vehicle_type)
      return Alert.alert('Required', 'Registration, make, model, and vehicle type are required.');
    setBusy(true);
    const { error } = await supabase
      .from('vehicles')
      .insert({ ...form, manufacturing_year: Number(form.manufacturing_year) });
    if (error) Alert.alert('Unable to add vehicle', error.message);
    else onSaved();
    setBusy(false);
  };
  return (
    <View style={[styles.form, { backgroundColor: palette.card }]}>
      {(
        [
          'registration_number',
          'make',
          'model',
          'vehicle_type',
          'manufacturing_year',
          'department',
          'assigned_driver',
          'fuel_type',
        ] as Array<keyof typeof form>
      ).map((key) => (
        <Field
          key={key}
          label={key.replaceAll('_', ' ')}
          value={form[key]}
          onChange={set(key)}
          palette={palette}
        />
      ))}
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
  palette: { card: string; text: string; muted: string };
}) {
  const [vehicleId, setVehicleId] = useState('');
  const [mode, setMode] = useState<'mileage' | 'inspection' | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [odometer, setOdometer] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [condition, setCondition] = useState('Good');
  const [remarks, setRemarks] = useState('');
  const [mileageRows, setMileageRows] = useState<RecordRow[]>([]);
  const [inspectionRows, setInspectionRows] = useState<RecordRow[]>([]);
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
        .select('id, vehicle_id, inspection_date, overall_condition, remarks')
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
    if (!vehicleId || !date || !Number.isFinite(reading) || reading < 0) {
      Alert.alert('Required', 'Select a vehicle, enter a valid odometer reading, and choose a date.');
      return;
    }
    const { error } = await supabase.from('mileage_records').insert({
      vehicle_id: vehicleId,
      recorded_by: userId,
      odometer_reading: reading,
      reading_date: date,
      notes: remarks,
    });
    if (error) Alert.alert('Unable to save mileage', error.message);
    else {
      setOdometer('');
      setRemarks('');
      await loadHistory();
      Alert.alert('Saved', 'Mileage reading added.');
    }
  };
  const saveInspection = async () => {
    if (!canManage) return;
    if (!vehicleId || !date || !condition) {
      Alert.alert('Required', 'Select a vehicle, choose a date, and enter the condition.');
      return;
    }
    const { error } = await supabase.from('inspections').insert({
      vehicle_id: vehicleId,
      inspector_id: userId,
      inspection_date: date,
      week_start_date: date,
      overall_condition: condition,
      remarks,
    });
    if (error) Alert.alert('Unable to save inspection', error.message);
    else {
      setRemarks('');
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
          <Field label="Date (YYYY-MM-DD)" value={date} onChange={setDate} palette={palette} />
          {mode === 'mileage' ? (
            <Field
              label="Odometer reading (km)"
              value={odometer}
              onChange={setOdometer}
              palette={palette}
              keyboardType="decimal-pad"
            />
          ) : (
            <Field label="Overall condition" value={condition} onChange={setCondition} palette={palette} />
          )}
          <Field label="Remarks" value={remarks} onChange={setRemarks} palette={palette} />
          {canManage && (
            <Button
              title={mode === 'mileage' ? 'Save mileage' : 'Save inspection'}
              onPress={() => void (mode === 'mileage' ? saveMileage() : saveInspection())}
            />
          )}
        </View>
      )}
      {selectedVehicle && (
        <>
          <View style={styles.historyHeader}>
            <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Recent mileage</Text>
            <Text style={[styles.sectionHint, { color: palette.muted }]}>Last 5 readings</Text>
          </View>
          {mileageRows.length ? (
            mileageRows.map((r) => (
              <View key={r.id} style={[styles.historyCard, { backgroundColor: palette.card }]}>
                <Text style={[styles.historyValue, { color: palette.text }]}>
                  {String(r.odometer_reading)} km
                </Text>
                <Text style={{ color: palette.muted }}>{String(r.reading_date)}</Text>
                {r.notes ? <Text style={{ color: palette.muted }}>{String(r.notes)}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={{ color: palette.muted }}>No mileage readings for this vehicle.</Text>
          )}
          <View style={styles.historyHeader}>
            <Text style={[styles.detailSectionTitle, { color: palette.text }]}>
              Recent inspections
            </Text>
            <Text style={[styles.sectionHint, { color: palette.muted }]}>Last 5 inspections</Text>
          </View>
          {inspectionRows.length ? (
            inspectionRows.map((r) => (
              <View key={r.id} style={[styles.historyCard, { backgroundColor: palette.card }]}>
                <Text style={[styles.historyValue, { color: palette.text }]}>
                  {String(r.overall_condition)}
                </Text>
                <Text style={{ color: palette.muted }}>{String(r.inspection_date)}</Text>
                {r.remarks ? <Text style={{ color: palette.muted }}>{String(r.remarks)}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={{ color: palette.muted }}>No inspections for this vehicle.</Text>
          )}
        </>
      )}
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
  palette: { card: string; text: string; muted: string };
}) {
  const [vehicleId, setVehicleId] = useState('');
  const [type, setType] = useState('Revenue Licence');
  const [issue, setIssue] = useState('');
  const [expiry, setExpiry] = useState('');
  const [reference, setReference] = useState('');
  const [fileUri, setFileUri] = useState('');
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [view, setView] = useState<string | null>(null);
  const load = async () => {
    const { data } = await supabase
      .from('compliance_records')
      .select(
        'id, vehicle_id, compliance_type, issue_date, expiry_date, reference_number, status, file_path',
      )
      .order('expiry_date');
    setRows((data ?? []) as RecordRow[]);
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const existing = rows.find(
      (row) => row.vehicle_id === vehicleId && row.compliance_type === type,
    );
    setIssue(String(existing?.issue_date ?? ''));
    setExpiry(String(existing?.expiry_date ?? ''));
    setReference(String(existing?.reference_number ?? ''));
    setFileUri('');
  }, [vehicleId, type, rows]);
  const save = async () => {
    if (!canManage || !vehicleId) {
      Alert.alert('Required', 'Select a vehicle before saving compliance.');
      return;
    }
    const { data: existing } = await supabase
      .from('compliance_records')
      .select('id, file_path')
      .eq('vehicle_id', vehicleId)
      .eq('compliance_type', type)
      .maybeSingle();
    let uploadedPath: string | null = null;
    try {
      if (fileUri) {
        uploadedPath = `${vehicleId}/compliance-${Date.now()}-${fileUri.split('/').pop() ?? 'certificate'}`;
        const response = await fetch(fileUri);
        const blob = await response.blob();
        const { error: uploadError } = await supabase.storage
          .from('vehicle-documents')
          .upload(uploadedPath, blob, { upsert: false });
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
      const result = existing
        ? await supabase.from('compliance_records').update(values).eq('id', existing.id)
        : await supabase.from('compliance_records').insert(values);
      if (result.error) throw result.error;
      if (uploadedPath && existing?.file_path) {
        await supabase.storage.from('vehicle-documents').remove([String(existing.file_path)]);
      }
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
      <VehiclePicker
        vehicles={vehicles}
        value={vehicleId}
        onChange={setVehicleId}
        palette={palette}
      />
      <View style={styles.pickerWrap}>
        {['Revenue Licence', 'Emission Test', 'Insurance'].map((v) => (
          <Pressable
            key={v}
            onPress={() => setType(v)}
            style={[styles.picker, { backgroundColor: type === v ? colors.red : palette.card }]}
          >
            <Text style={{ color: type === v ? '#fff' : palette.text }}>{v}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Issue date" value={issue} onChange={setIssue} palette={palette} />
      <Field label="Expiry date" value={expiry} onChange={setExpiry} palette={palette} />
      <Field label="Reference number" value={reference} onChange={setReference} palette={palette} />
      {canManage && (
        <>
          <Button
            title={fileUri ? 'Replace certificate photo' : 'Choose certificate photo'}
            onPress={() => void choosePhoto().then((uri) => uri && setFileUri(uri))}
          />
          {fileUri ? <Text style={{ color: palette.muted }}>Certificate photo selected.</Text> : null}
          <Button title="Save compliance certificate" onPress={() => void save()} />
        </>
      )}
      {rows.map((r) => (
        <View key={r.id} style={[styles.card, { backgroundColor: palette.card }]}>
          <Text style={{ color: palette.text }}>
            {String(r.compliance_type)} · {String(r.expiry_date ?? 'No expiry')} ·{' '}
            {String(r.status)}
          </Text>
          <Text style={{ color: palette.muted }}>
            {String(r.reference_number ?? 'No reference')}
          </Text>
          {r.file_path ? (
            <Button title="View certificate" onPress={() => setView(String(r.file_path))} />
          ) : (
            <Text style={{ color: palette.muted }}>No certificate uploaded.</Text>
          )}
        </View>
      ))}
      <Modal visible={!!view} transparent animationType="fade" onRequestClose={() => setView(null)}>
        <View style={styles.overlay}>
          <View style={[styles.viewer, { backgroundColor: palette.card }]}>
            <Heading palette={palette}>Compliance certificate</Heading>
            {view ? <SignedContent path={view} /> : null}
            <Button title="Close" onPress={() => setView(null)} />
          </View>
        </View>
      </Modal>
    </Panel>
  );
}

function Maintenance({
  vehicles,
  canManage,
  palette,
}: {
  vehicles: VehicleRecord[];
  canManage: boolean;
  palette: { card: string; text: string; muted: string };
}) {
  const [vehicleId, setVehicleId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [odometer, setOdometer] = useState('');
  const [serviceType, setServiceType] = useState('Preventive service');
  const [description, setDescription] = useState('');
  const [serviceStation, setServiceStation] = useState('');
  const [provider, setProvider] = useState('');
  const [cost, setCost] = useState('');
  const [receiptUri, setReceiptUri] = useState('');
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [view, setView] = useState<string | null>(null);
  const load = async () => {
    const { data } = await supabase
      .from('maintenance_records')
      .select(
        'id, vehicle_id, service_date, odometer_reading, service_type, description, service_station, provider, cost, document_path',
      )
      .order('service_date', { ascending: false });
    setRows((data ?? []) as RecordRow[]);
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async () => {
    if (!canManage) return;
    if (!vehicleId || !date || !odometer || !serviceStation) {
      Alert.alert('Required', 'Vehicle, date, odometer, and service station / garage are required.');
      return;
    }
    let receiptPath: string | null = null;
    try {
      if (receiptUri) {
        receiptPath = `${vehicleId}/maintenance-${Date.now()}-${receiptUri.split('/').pop() ?? 'receipt'}`;
        const response = await fetch(receiptUri);
        const blob = await response.blob();
        const { error: uploadError } = await supabase.storage
          .from('vehicle-documents')
          .upload(receiptPath, blob, { upsert: false });
        if (uploadError) throw uploadError;
      }
      const { error } = await supabase.from('maintenance_records').insert({
        vehicle_id: vehicleId,
        service_date: date,
        odometer_reading: Number(odometer),
        service_type: serviceType,
        description,
        service_station: serviceStation,
        provider,
        cost: cost ? Number(cost) : null,
        document_path: receiptPath,
      });
      if (error) throw error;
      setReceiptUri('');
      await load();
      Alert.alert('Saved', 'Maintenance record added.');
    } catch (e) {
      if (receiptPath) await supabase.storage.from('vehicle-documents').remove([receiptPath]);
      Alert.alert('Unable to save maintenance', e instanceof Error ? e.message : 'Try again.');
    }
  };
  return (
    <Panel>
      <Heading palette={palette}>Maintenance and repairs</Heading>
      {!canManage && <Text style={{ color: palette.muted }}>Management access is read-only.</Text>}
      <VehiclePicker
        vehicles={vehicles}
        value={vehicleId}
        onChange={setVehicleId}
        palette={palette}
      />
      {[
        ['Service date', date, setDate],
        ['Odometer', odometer, setOdometer],
        ['Service type', serviceType, setServiceType],
        ['Service station / garage', serviceStation, setServiceStation],
        ['Description', description, setDescription],
        ['Provider', provider, setProvider],
        ['Cost', cost, setCost],
      ].map(([label, value, setter]) => (
        <Field
          key={String(label)}
          label={String(label)}
          value={String(value)}
          onChange={setter as (v: string) => void}
          palette={palette}
        />
      ))}
      {canManage && (
        <>
          <Button
            title={receiptUri ? 'Replace receipt photo' : 'Choose receipt photo'}
            onPress={() => void choosePhoto().then((uri) => uri && setReceiptUri(uri))}
          />
          {receiptUri ? <Text style={{ color: palette.muted }}>Receipt photo selected.</Text> : null}
        </>
      )}
      {canManage && <Button title="Save maintenance" onPress={() => void save()} />}
      {rows.map((r) => (
        <View key={r.id} style={[styles.card, { backgroundColor: palette.card }]}>
          <Text style={{ color: palette.text }}>
            {String(r.service_date)} · {String(r.service_type)}
          </Text>
          <Text style={{ color: palette.muted }}>
            {String(r.service_station ?? '')} · {String(r.provider ?? '')} ·{' '}
            {String(r.cost ?? '')}
          </Text>
          {r.document_path ? (
            <Button title="View receipt" onPress={() => setView(String(r.document_path))} />
          ) : (
            <Text style={{ color: palette.muted }}>No receipt uploaded.</Text>
          )}
        </View>
      ))}
      <Modal visible={!!view} transparent animationType="fade" onRequestClose={() => setView(null)}>
        <View style={styles.overlay}>
          <View style={[styles.viewer, { backgroundColor: palette.card }]}>
            <Heading palette={palette}>Maintenance receipt</Heading>
            {view ? <SignedContent path={view} /> : null}
            <Button title="Close" onPress={() => setView(null)} />
          </View>
        </View>
      </Modal>
    </Panel>
  );
}

function SignedContent({ path, gallery = false }: { path: string; gallery?: boolean }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    void supabase.storage
      .from('vehicle-documents')
      .createSignedUrl(path, 300)
      .then(({ data }) => setUrl(data?.signedUrl ?? ''));
  }, [path]);
  return url ? (
    <Image
      source={{ uri: url }}
      style={[styles.documentImage, gallery && styles.galleryImage]}
      resizeMode="cover"
    />
  ) : (
    <Text style={styles.error}>Loading document...</Text>
  );
}

function VehicleProfile({
  vehicle,
  visible,
  onClose,
  canManage,
  userId,
  palette,
}: {
  vehicle: VehicleRecord | null;
  visible: boolean;
  onClose: () => void;
  canManage: boolean;
  userId: string;
  palette: { bg: string; card: string; text: string; muted: string };
}) {
  const [mileage, setMileage] = useState<RecordRow[]>([]);
  const [maintenance, setMaintenance] = useState<RecordRow[]>([]);
  const [inspections, setInspections] = useState<RecordRow[]>([]);
  const [compliance, setCompliance] = useState<RecordRow[]>([]);
  const [photos, setPhotos] = useState<RecordRow[]>([]);
  const [photoUri, setPhotoUri] = useState('');
  const [viewFile, setViewFile] = useState<string | null>(null);
  const [tab, setTab] = useState('overview');
  useEffect(() => {
    if (!vehicle || !visible) return;
    const load = async () => {
      const [m, s, i, c, p] = await Promise.all([
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
      ]);
      setMileage((m.data ?? []) as RecordRow[]);
      setMaintenance((s.data ?? []) as RecordRow[]);
      setInspections((i.data ?? []) as RecordRow[]);
      setCompliance((c.data ?? []) as RecordRow[]);
      setPhotos((p.data ?? []) as RecordRow[]);
    };
    void load();
  }, [vehicle, visible]);
  if (!vehicle) return null;
  const addPhoto = async () => {
    if (!canManage || !photoUri) return;
    const filePath = `${vehicle.id}/${Date.now()}-${photoUri.split('/').pop() ?? 'photo'}`;
    try {
      const response = await fetch(photoUri);
      const blob = await response.blob();
      const { error } = await supabase.storage
        .from('vehicle-documents')
        .upload(filePath, blob, { upsert: false });
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
      setPhotos((current) => [...current, data as RecordRow]);
      setPhotoUri('');
      Alert.alert('Saved', 'Vehicle photo added.');
    } catch (e) {
      Alert.alert('Unable to upload photo', e instanceof Error ? e.message : 'Use a local file URI.');
    }
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
          <Pressable onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.panel}>
          <View style={styles.vehicleDetailMeta}>
            <Text style={styles.vehicleDetailIcon}>{vehicleIcon(vehicle.vehicle_type)}</Text>
            <Text style={{ color: palette.muted }}>
              {vehicle.vehicle_type} · {vehicle.status === 'active' ? 'Active' : 'Archived'}
            </Text>
          </View>
          {photos.length ? (
            <View style={styles.photoSection}>
              <View style={styles.detailSectionHeader}>
                <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Vehicle photos</Text>
                <Text style={[styles.sectionHint, { color: palette.muted }]}>
                  {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                </Text>
              </View>
              <ScrollView
                horizontal={photos.length > 1}
                showsHorizontalScrollIndicator={photos.length > 1}
                contentContainerStyle={styles.photoGallery}
              >
                {photos.map((p) => (
                  <SignedContent key={p.id} path={String(p.file_path)} gallery />
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={[styles.emptyPhoto, { backgroundColor: palette.card }]}>
              <Text style={{ color: palette.muted }}>No photos added yet.</Text>
            </View>
          )}
          {canManage && (
            <View style={[styles.photoUploadCard, { backgroundColor: palette.card }]}>
              <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Add another photo</Text>
              <Field
                label="Local photo URI"
                value={photoUri}
                onChange={setPhotoUri}
                palette={palette}
              />
              <Button title="Add photo" onPress={() => void addPhoto()} />
            </View>
          )}
          <View style={styles.pickerWrap}>
            {['overview', 'photos', 'mileage', 'inspections', 'maintenance', 'compliance'].map(
              (v) => (
                <Pressable
                  key={v}
                  onPress={() => setTab(v)}
                  style={[
                    styles.picker,
                    { backgroundColor: tab === v ? colors.red : palette.card },
                  ]}
                >
                  <Text style={{ color: tab === v ? '#fff' : palette.text }}>{v}</Text>
                </Pressable>
              ),
            )}
          </View>
          {tab === 'overview' && (
            <View style={[styles.detailCard, { backgroundColor: palette.card }]}>
              <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Vehicle details</Text>
              <Text style={{ color: palette.text }}>Year: {vehicle.manufacturing_year}</Text>
              <Text style={{ color: palette.muted }}>Department: {vehicle.department ?? '—'}</Text>
              <Text style={{ color: palette.muted }}>Driver: {vehicle.assigned_driver ?? '—'}</Text>
              <Text style={{ color: palette.muted }}>Fuel: {vehicle.fuel_type ?? '—'}</Text>
              <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Mileage records</Text>
              <Rows rows={mileage} palette={palette} />
              <Text style={[styles.detailSectionTitle, { color: palette.text }]}>Inspection records</Text>
              <Rows rows={inspections} palette={palette} />
            </View>
          )}
          {tab === 'photos' && <Text style={{ color: palette.muted }}>Photos are shown above.</Text>}
          {tab === 'mileage' && <Rows rows={mileage} palette={palette} />}
          {tab === 'inspections' && <Rows rows={inspections} palette={palette} />}
          {tab === 'maintenance' && (
            <Rows
              rows={maintenance}
              palette={palette}
              fileKey="document_path"
              onViewFile={setViewFile}
            />
          )}
          {tab === 'compliance' && (
            <Rows rows={compliance} palette={palette} fileKey="file_path" onViewFile={setViewFile} />
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
              <Button title="Close" onPress={() => setViewFile(null)} />
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
            <Button title="View attachment" onPress={() => onViewFile(String(r[fileKey]))} />
          ) : null}
        </View>
      ))}
    </>
  ) : (
    <Text style={{ color: palette.muted }}>No records yet.</Text>
  );
}
function Reports({
  vehicles,
  palette,
}: {
  vehicles: VehicleRecord[];
  palette: { card: string; text: string; muted: string };
}) {
  const [vehicleId, setVehicleId] = useState('');
  const [report, setReport] = useState('');
  const generate = async () => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return;
    const [m, s, i, c] = await Promise.all([
      supabase
        .from('mileage_records')
        .select('reading_date, odometer_reading, notes')
        .eq('vehicle_id', v.id),
      supabase
        .from('maintenance_records')
        .select('service_date, service_type, description, service_station, provider, cost')
        .eq('vehicle_id', v.id),
      supabase
        .from('inspections')
        .select('inspection_date, overall_condition, remarks')
        .eq('vehicle_id', v.id),
      supabase
        .from('compliance_records')
        .select('compliance_type, issue_date, expiry_date, status, reference_number')
        .eq('vehicle_id', v.id),
    ]);
    setReport(
      [
        `Vehicle details\\nRegistration,${v.registration_number}\\nMake,${v.make}\\nModel,${v.model}\\nYear,${v.manufacturing_year}`,
        `Mileage history\\n${(m.data ?? []).map((r) => `${r.reading_date},${r.odometer_reading},${r.notes ?? ''}`).join('\\n')}`,
        `Service history\\n${(s.data ?? []).map((r) => `${r.service_date},${r.service_type},${r.service_station ?? ''},${r.provider ?? ''},${r.cost ?? ''}`).join('\\n')}`,
        `Inspection history\\n${(i.data ?? []).map((r) => `${r.inspection_date},${r.overall_condition},${r.remarks ?? ''}`).join('\\n')}`,
        `Compliance history\\n${(c.data ?? []).map((r) => `${r.compliance_type},${r.issue_date ?? ''},${r.expiry_date ?? ''},${r.status}`).join('\\n')}`,
      ].join('\\n\\n'),
    );
  };
  return (
    <Panel>
      <Heading palette={palette}>Structured vehicle report</Heading>
      <Text style={{ color: palette.muted }}>
        Select one vehicle to generate a sectioned report. Copy/export can be added when a sharing
        module is installed.
      </Text>
      <VehiclePicker
        vehicles={vehicles}
        value={vehicleId}
        onChange={setVehicleId}
        palette={palette}
      />
      <Button title="Generate report" onPress={() => void generate()} />
      {report ? (
        <Text
          selectable
          style={[styles.report, { color: palette.text, backgroundColor: palette.card }]}
        >
          {report}
        </Text>
      ) : null}
    </Panel>
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
  listToggleActive: { backgroundColor: colors.navy },
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
  detailSectionTitle: { fontSize: 16, fontWeight: '800' },
  photoSection: { gap: 4 },
  photoGallery: { gap: 10 },
  emptyPhoto: { alignItems: 'center', borderRadius: 12, padding: 28 },
  photoUploadCard: { borderRadius: 12, gap: 8, padding: 12 },
  detailCard: { borderRadius: 12, gap: 8, padding: 14 },
  operationsIntro: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 5 },
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
  historyHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
  },
  historyCard: { borderLeftColor: colors.red, borderLeftWidth: 4, borderRadius: 10, gap: 4, padding: 12 },
  historyValue: { fontSize: 16, fontWeight: '900' },
  form: { borderRadius: 12, gap: 10, padding: 14 },
  input: { borderRadius: 8, borderWidth: 1, fontSize: 15, padding: 11 },
  button: { backgroundColor: colors.red, borderRadius: 8, marginVertical: 3, padding: 11 },
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
