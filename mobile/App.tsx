import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { AppConfig, VehicleRecord } from '@vehicle-management/shared';
import { supabase, type Profile } from './src/lib/supabase';

const config: AppConfig = { appName: 'Riyon International Pvt Ltd', version: '0.1.0' };
const logo = require('./assets/riyon-logo.png');
type Section = 'fleet' | 'operations' | 'compliance' | 'maintenance' | 'documents' | 'reports';
type RecordRow = Record<string, unknown> & { id: string; vehicle_id: string };
const colors = { red: '#b42318', navy: '#102a43', muted: '#52606d', border: '#d9e2ec' };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [section, setSection] = useState<Section | null>(null);
  const [selected, setSelected] = useState<VehicleRecord | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
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
        <View style={styles.header}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: palette.muted }]}>{config.appName}</Text>
            <Text style={[styles.title, { color: palette.text }]}>Vehicle Management System</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              Welcome back, {profile.full_name}
            </Text>
          </View>
        </View>
        <View style={styles.toolbar}>
          <Text style={[styles.role, { color: palette.muted }]}>{profile.role}</Text>
          <View style={styles.themeRow}>
            <Text style={{ color: palette.muted }}>Dark</Text>
            <Switch
              value={dark}
              onValueChange={(v) => setTheme(v ? 'dark' : 'light')}
              trackColor={{ true: colors.red }}
            />
          </View>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.tiles}>
          {(
            [
              ['fleet', 'Vehicles', 'Register, archive, restore'],
              ['operations', 'Weekly records', 'Mileage and inspections'],
              ['compliance', 'Compliance', 'Licences, tests, insurance'],
              ['maintenance', 'Maintenance', 'Service and repair history'],
              ['documents', 'Documents', 'Secure vehicle documents'],
              ['reports', 'Reports', 'Structured vehicle report'],
            ] as Array<[Section, string, string]>
          ).map(([id, title, description], index) => (
            <Pressable
              key={id}
              style={[styles.tile, { backgroundColor: palette.card }]}
              onPress={() => setSection(id)}
            >
              <Text style={styles.tileNumber}>{String(index + 1).padStart(2, '0')}</Text>
              <Text style={[styles.tileTitle, { color: palette.text }]}>{title}</Text>
              <Text style={[styles.tileText, { color: palette.muted }]}>{description}</Text>
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
            <Compliance vehicles={vehicles} canManage={!!canManage} palette={palette} />
          )}
          {section === 'maintenance' && (
            <Maintenance vehicles={vehicles} canManage={!!canManage} palette={palette} />
          )}
          {section === 'documents' && (
            <Documents
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
        canManage={!!canManage}
        userId={session.user.id}
        palette={palette}
      />
      <StatusBar style={dark ? 'light' : 'dark'} />
    </View>
  );
}

function sectionTitle(section: Section | null) {
  return {
    fleet: 'Vehicles',
    operations: 'Weekly records',
    compliance: 'Compliance',
    maintenance: 'Maintenance',
    documents: 'Documents',
    reports: 'Reports',
  }[section ?? 'fleet'];
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  palette: { text: string; card: string };
  secure?: boolean;
}) {
  return (
    <TextInput
      placeholder={label}
      placeholderTextColor="#829ab1"
      autoCapitalize="none"
      secureTextEntry={secure}
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
      {showForm && (
        <VehicleForm
          onSaved={() => {
            setShowForm(false);
            void onRefresh();
          }}
          palette={palette}
        />
      )}
      {vehicles.length === 0 ? (
        <Text style={{ color: palette.muted }}>No vehicles have been registered yet.</Text>
      ) : (
        vehicles.map((v) => (
          <View key={v.id} style={[styles.card, { backgroundColor: palette.card }]}>
            <Pressable onPress={() => onSelect(v)}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>
                {v.registration_number}
              </Text>
              <Text style={{ color: palette.muted }}>
                {v.make} {v.model} · {v.vehicle_type} · {v.status}
              </Text>
              <Text style={{ color: palette.muted }}>
                {v.department ?? 'No department'} · {v.assigned_driver ?? 'No driver'}
              </Text>
            </Pressable>
            {canManage && (
              <Button
                title={v.status === 'active' ? 'Archive' : 'Restore'}
                disabled={busy}
                onPress={() => void changeStatus(v)}
              />
            )}
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
  const [odometer, setOdometer] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [condition, setCondition] = useState('Good');
  const [remarks, setRemarks] = useState('');
  const [rows, setRows] = useState<RecordRow[]>([]);
  const load = async () => {
    const { data } = await supabase
      .from('mileage_records')
      .select('id, vehicle_id, odometer_reading, reading_date, notes')
      .order('reading_date', { ascending: false })
      .limit(50);
    setRows((data ?? []) as RecordRow[]);
  };
  useEffect(() => {
    void load();
  }, []);
  const saveMileage = async () => {
    if (!canManage) return;
    const { error } = await supabase.from('mileage_records').insert({
      vehicle_id: vehicleId,
      recorded_by: userId,
      odometer_reading: Number(odometer),
      reading_date: date,
      notes: remarks,
    });
    if (error) Alert.alert('Unable to save mileage', error.message);
    else {
      setOdometer('');
      await load();
    }
  };
  const saveInspection = async () => {
    if (!canManage) return;
    const { error } = await supabase.from('inspections').insert({
      vehicle_id: vehicleId,
      inspector_id: userId,
      inspection_date: date,
      week_start_date: date,
      odometer_reading: Number(odometer),
      overall_condition: condition,
      remarks,
    });
    if (error) Alert.alert('Unable to save inspection', error.message);
    else Alert.alert('Saved', 'Weekly inspection recorded.');
  };
  return (
    <Panel>
      <Heading palette={palette}>Mileage and inspections</Heading>
      {!canManage && <Text style={{ color: palette.muted }}>Management access is read-only.</Text>}
      <VehiclePicker
        vehicles={vehicles}
        value={vehicleId}
        onChange={setVehicleId}
        palette={palette}
      />
      <Field label="Date (YYYY-MM-DD)" value={date} onChange={setDate} palette={palette} />
      <Field label="Odometer reading" value={odometer} onChange={setOdometer} palette={palette} />
      <Field label="Condition" value={condition} onChange={setCondition} palette={palette} />
      <Field label="Remarks" value={remarks} onChange={setRemarks} palette={palette} />
      {canManage && (
        <View style={styles.row}>
          <Button title="Save mileage" onPress={() => void saveMileage()} />
          <Button title="Save inspection" onPress={() => void saveInspection()} />
        </View>
      )}
      <Heading palette={palette}>Recent mileage</Heading>
      {rows.map((r) => (
        <View key={r.id} style={[styles.card, { backgroundColor: palette.card }]}>
          <Text style={{ color: palette.text }}>
            {String(r.reading_date)} · {String(r.odometer_reading)} km
          </Text>
          <Text style={{ color: palette.muted }}>{String(r.notes ?? '')}</Text>
        </View>
      ))}
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
  const [rows, setRows] = useState<RecordRow[]>([]);
  const load = async () => {
    const { data } = await supabase
      .from('compliance_records')
      .select('id, vehicle_id, compliance_type, issue_date, expiry_date, reference_number, status')
      .order('expiry_date');
    setRows((data ?? []) as RecordRow[]);
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async () => {
    if (!canManage) return;
    const { data: existing } = await supabase
      .from('compliance_records')
      .select('id')
      .eq('vehicle_id', vehicleId)
      .eq('compliance_type', type)
      .maybeSingle();
    if (existing)
      return Alert.alert('Duplicate record', `${type} already exists for this vehicle.`);
    const { error } = await supabase.from('compliance_records').insert({
      vehicle_id: vehicleId,
      compliance_type: type,
      issue_date: issue || null,
      expiry_date: expiry || null,
      reference_number: reference || null,
      status: 'active',
    });
    if (error) Alert.alert('Unable to save compliance', error.message);
    else {
      await load();
      Alert.alert('Saved', 'Compliance record added.');
    }
  };
  return (
    <Panel>
      <Heading palette={palette}>Compliance records</Heading>
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
      {canManage && <Button title="Save compliance" onPress={() => void save()} />}
      {rows.map((r) => (
        <View key={r.id} style={[styles.card, { backgroundColor: palette.card }]}>
          <Text style={{ color: palette.text }}>
            {String(r.compliance_type)} · {String(r.expiry_date ?? 'No expiry')}
          </Text>
          <Text style={{ color: palette.muted }}>
            {String(r.reference_number ?? '')} · {String(r.status)}
          </Text>
        </View>
      ))}
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
  const [serviceType, setServiceType] = useState('Service');
  const [description, setDescription] = useState('');
  const [provider, setProvider] = useState('');
  const [cost, setCost] = useState('');
  const [rows, setRows] = useState<RecordRow[]>([]);
  const load = async () => {
    const { data } = await supabase
      .from('maintenance_records')
      .select(
        'id, vehicle_id, service_date, odometer_reading, service_type, description, provider, cost',
      )
      .order('service_date', { ascending: false });
    setRows((data ?? []) as RecordRow[]);
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async () => {
    if (!canManage) return;
    const { error } = await supabase.from('maintenance_records').insert({
      vehicle_id: vehicleId,
      service_date: date,
      odometer_reading: Number(odometer),
      service_type: serviceType,
      description,
      provider,
      cost: cost ? Number(cost) : null,
    });
    if (error) Alert.alert('Unable to save maintenance', error.message);
    else await load();
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
      {canManage && <Button title="Save maintenance" onPress={() => void save()} />}
      {rows.map((r) => (
        <View key={r.id} style={[styles.card, { backgroundColor: palette.card }]}>
          <Text style={{ color: palette.text }}>
            {String(r.service_date)} · {String(r.service_type)}
          </Text>
          <Text style={{ color: palette.muted }}>
            {String(r.provider ?? '')} · {String(r.cost ?? '')}
          </Text>
        </View>
      ))}
    </Panel>
  );
}

function Documents({
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
  const [type, setType] = useState('Revenue Licence');
  const [path, setPath] = useState('');
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [view, setView] = useState<RecordRow | null>(null);
  const load = async () => {
    const { data } = await supabase
      .from('vehicle_documents')
      .select(
        'id, vehicle_id, document_type, reference_number, issue_date, expiry_date, file_path, created_at',
      )
      .neq('document_type', 'Vehicle Photo')
      .order('created_at', { ascending: false });
    setRows((data ?? []) as RecordRow[]);
  };
  useEffect(() => {
    void load();
  }, []);
  const upload = async () => {
    if (!canManage || !path || !vehicleId) return;
    const filePath = `${vehicleId}/${Date.now()}-${path.split('/').pop() ?? 'document'}`;
    try {
      const response = await fetch(path);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage
        .from('vehicle-documents')
        .upload(filePath, blob, { upsert: false });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from('vehicle_documents').insert({
        vehicle_id: vehicleId,
        document_type: type,
        file_path: filePath,
        uploaded_by: userId,
      });
      if (error) throw error;
      setPath('');
      await load();
    } catch (e) {
      Alert.alert('Unable to upload', e instanceof Error ? e.message : 'Use a local file URI.');
    }
  };
  const remove = async (r: RecordRow) => {
    if (!canManage) return;
    if (r.file_path) await supabase.storage.from('vehicle-documents').remove([String(r.file_path)]);
    const { error } = await supabase.from('vehicle_documents').delete().eq('id', r.id);
    if (error) Alert.alert('Unable to remove', error.message);
    else await load();
  };
  const replace = async (r: RecordRow) => {
    if (!canManage || !path || !r.file_path) return;
    try {
      const response = await fetch(path);
      const blob = await response.blob();
      const nextPath = `${String(r.vehicle_id)}/${Date.now()}-${path.split('/').pop() ?? 'document'}`;
      const { error: uploadError } = await supabase.storage
        .from('vehicle-documents')
        .upload(nextPath, blob, { upsert: false });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase
        .from('vehicle_documents')
        .update({ file_path: nextPath, uploaded_by: userId })
        .eq('id', r.id);
      if (updateError) throw updateError;
      await supabase.storage.from('vehicle-documents').remove([String(r.file_path)]);
      setPath('');
      await load();
    } catch (e) {
      Alert.alert('Unable to replace', e instanceof Error ? e.message : 'Use a local file URI.');
    }
  };
  return (
    <Panel>
      <Heading palette={palette}>Documents</Heading>
      <Text style={{ color: palette.muted }}>
        Vehicle Photo is intentionally excluded from this document list.
      </Text>
      {!canManage && <Text style={{ color: palette.muted }}>Management access is read-only.</Text>}
      <VehiclePicker
        vehicles={vehicles}
        value={vehicleId}
        onChange={setVehicleId}
        palette={palette}
      />
      {canManage && (
        <>
          <View style={styles.pickerWrap}>
            {['Revenue Licence', 'Emission Test', 'Insurance', 'Other'].map((v) => (
              <Pressable
                key={v}
                onPress={() => setType(v)}
                style={[styles.picker, { backgroundColor: type === v ? colors.red : palette.card }]}
              >
                <Text style={{ color: type === v ? '#fff' : palette.text }}>{v}</Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="Local file URI (for upload)"
            value={path}
            onChange={setPath}
            palette={palette}
          />
          <Button title="Upload document" onPress={() => void upload()} />
        </>
      )}
      {rows.map((r) => (
        <View key={r.id} style={[styles.card, { backgroundColor: palette.card }]}>
          <Text style={{ color: palette.text }}>{String(r.document_type)}</Text>
          <View style={styles.row}>
            <Button title="View" onPress={() => setView(r)} />
            {canManage && (
              <Button title="Replace" onPress={() => void replace(r)} disabled={!path} />
            )}
            {canManage && <Button title="Remove" onPress={() => void remove(r)} />}
          </View>
        </View>
      ))}
      <Modal visible={!!view} transparent animationType="fade" onRequestClose={() => setView(null)}>
        <View style={styles.overlay}>
          <View style={[styles.viewer, { backgroundColor: palette.card }]}>
            <Text style={[styles.heading, { color: palette.text }]}>
              {String(view?.document_type ?? '')}
            </Text>
            <Text style={{ color: palette.muted }}>
              Document content is only loaded after View.
            </Text>
            {view?.file_path ? (
              <SignedContent path={String(view.file_path)} />
            ) : (
              <Text style={{ color: palette.muted }}>No file attached.</Text>
            )}
            <Button title="Close" onPress={() => setView(null)} />
          </View>
        </View>
      </Modal>
    </Panel>
  );
}
function SignedContent({ path }: { path: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    void supabase.storage
      .from('vehicle-documents')
      .createSignedUrl(path, 300)
      .then(({ data }) => setUrl(data?.signedUrl ?? ''));
  }, [path]);
  return url ? (
    <Image source={{ uri: url }} style={styles.documentImage} resizeMode="contain" />
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
    const response = await fetch(photoUri);
    const blob = await response.blob();
    const { error } = await supabase.storage
      .from('vehicle-documents')
      .upload(filePath, blob, { upsert: false });
    if (error) return Alert.alert('Unable to upload photo', error.message);
    await supabase.from('vehicle_documents').insert({
      vehicle_id: vehicle.id,
      document_type: 'Vehicle Photo',
      file_path: filePath,
      uploaded_by: userId,
    });
    setPhotoUri('');
    Alert.alert('Saved', 'Vehicle photo added.');
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalPage, { backgroundColor: palette.bg }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: palette.text }]}>
            {vehicle.registration_number}
          </Text>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.panel}>
          <Text style={{ color: palette.muted }}>
            {vehicle.make} {vehicle.model} · {vehicle.vehicle_type} · {vehicle.status}
          </Text>
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
            <View style={[styles.card, { backgroundColor: palette.card }]}>
              <Text style={{ color: palette.text }}>Year: {vehicle.manufacturing_year}</Text>
              <Text style={{ color: palette.muted }}>Department: {vehicle.department ?? '—'}</Text>
              <Text style={{ color: palette.muted }}>Driver: {vehicle.assigned_driver ?? '—'}</Text>
              <Text style={{ color: palette.muted }}>Fuel: {vehicle.fuel_type ?? '—'}</Text>
            </View>
          )}
          {tab === 'photos' && (
            <>
              <Text style={{ color: palette.muted }}>Photos</Text>
              {canManage && (
                <>
                  <Field
                    label="Local photo URI"
                    value={photoUri}
                    onChange={setPhotoUri}
                    palette={palette}
                  />
                  <Button title="Add photo" onPress={() => void addPhoto()} />
                </>
              )}
              {photos.map((p) => (
                <SignedContent key={p.id} path={String(p.file_path)} />
              ))}
            </>
          )}
          {tab === 'mileage' && <Rows rows={mileage} palette={palette} />}
          {tab === 'inspections' && <Rows rows={inspections} palette={palette} />}
          {tab === 'maintenance' && <Rows rows={maintenance} palette={palette} />}
          {tab === 'compliance' && <Rows rows={compliance} palette={palette} />}
        </ScrollView>
      </View>
    </Modal>
  );
}
function Rows({
  rows,
  palette,
}: {
  rows: RecordRow[];
  palette: { card: string; text: string; muted: string };
}) {
  return rows.length ? (
    <>
      {rows.map((r) => (
        <View key={r.id} style={[styles.card, { backgroundColor: palette.card }]}>
          {Object.entries(r)
            .filter(([k]) => !['id', 'vehicle_id'].includes(k))
            .slice(0, 6)
            .map(([k, v]) => (
              <Text key={k} style={{ color: palette.muted }}>
                {k.replaceAll('_', ' ')}: {String(v ?? '—')}
              </Text>
            ))}
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
        .select('service_date, service_type, description, provider, cost')
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
        `Service history\\n${(s.data ?? []).map((r) => `${r.service_date},${r.service_type},${r.provider ?? ''},${r.cost ?? ''}`).join('\\n')}`,
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
  content: { padding: 20, paddingTop: 55, paddingBottom: 30 },
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
  themeRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  tiles: { gap: 12, marginTop: 20 },
  tile: {
    borderRadius: 16,
    elevation: 2,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  tileNumber: { color: colors.red, fontWeight: '800' },
  tileTitle: { fontSize: 19, fontWeight: '800', marginTop: 6 },
  tileText: { fontSize: 14, marginTop: 5 },
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
  card: { borderRadius: 12, gap: 5, padding: 14 },
  cardTitle: { fontSize: 17, fontWeight: '800' },
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
  report: { fontFamily: 'monospace', padding: 12 },
});
