import { useEffect, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppConfig, VehicleRecord } from '@vehicle-management/shared';
import { supabase, type Profile } from './lib/supabase';
import './App.css';

const config: AppConfig = {
  appName: 'Riyon International Pvt Ltd',
  version: '0.1.0',
};
const currentYear = new Date().getFullYear();
type DashboardSection =
  'fleet' | 'operations' | 'compliance' | 'maintenance' | 'documents' | 'reports';
const uniqueDocumentTypes = new Set(['Revenue Licence', 'Emission Test', 'Insurance']);

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<DashboardSection | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setError(sessionError.message);
      } else if (active && data.session) {
        await loadProfile(data.session.user.id);
        setUser(data.session.user);
      }
      if (active) setLoading(false);
    };

    const loadProfile = async (userId: string) => {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', userId)
        .single();
      if (profileError) {
        setError('Your account does not have a Riyon International profile yet.');
        return;
      }
      if (active) setProfile(data as Profile);
    };

    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setUser(null);
        setProfile(null);
        return;
      }
      await loadProfile(session.user.id);
      setUser(session.user);
    });

    void loadSession();
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
  };

  if (loading)
    return (
      <main>
        <p>Loading Riyon International...</p>
      </main>
    );
  if (!user || !profile) return <Login error={error} onError={setError} />;

  return (
    <main>
      <header className="dashboard-header">
        <div>
          <div className="brand-lockup">
            <img src="/riyon-logo.png" alt="Riyon International logo" />
            <span>{config.appName}</span>
          </div>
          <h1>Vehicle Management System</h1>
          <p className="intro">Welcome back, {profile.full_name}.</p>
        </div>
        <div className="header-actions">
          <button
            className="theme-toggle"
            type="button"
            onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
          <span className="role-badge">{profile.role}</span>
        </div>
      </header>
      <DashboardTiles activeSection={activeSection} onSelect={setActiveSection} />
      {activeSection && (
        <div className="panel-backdrop" role="presentation">
          <section
            className={`panel-window ${activeSection}-panel`}
            role="dialog"
            aria-modal="true"
          >
            <button className="close-button" type="button" onClick={() => setActiveSection(null)}>
              Close
            </button>
            {activeSection === 'fleet' && (
              <VehicleManager userId={user.id} canManage={profile.role === 'administrator'} />
            )}
            {activeSection === 'operations' && (
              <OperationsPanel userId={user.id} canManage={profile.role === 'administrator'} />
            )}
            {activeSection === 'compliance' && (
              <CompliancePanel canManage={profile.role === 'administrator'} />
            )}
            {activeSection === 'maintenance' && (
              <MaintenancePanel canManage={profile.role === 'administrator'} />
            )}
            {activeSection === 'documents' && (
              <DocumentsPanel userId={user.id} canManage={profile.role === 'administrator'} />
            )}
            {activeSection === 'reports' && <ReportsPanel />}
          </section>
        </div>
      )}
      <button className="secondary-button" type="button" onClick={() => void signOut()}>
        Sign out
      </button>
      <footer>Version {config.version}</footer>
    </main>
  );
}

function DashboardTiles({
  activeSection,
  onSelect,
}: {
  activeSection: DashboardSection | null;
  onSelect: (section: DashboardSection) => void;
}) {
  const tiles: Array<{ id: DashboardSection; title: string; description: string; icon: string }> = [
    {
      id: 'fleet',
      title: 'Vehicles',
      description: 'Register, archive, and restore vehicles.',
      icon: '01',
    },
    {
      id: 'operations',
      title: 'Weekly records',
      description: 'Record inspections and mileage.',
      icon: '02',
    },
    {
      id: 'compliance',
      title: 'Compliance',
      description: 'Track licences, tests, and insurance.',
      icon: '03',
    },
    {
      id: 'maintenance',
      title: 'Maintenance',
      description: 'Manage service and repair history.',
      icon: '04',
    },
    {
      id: 'documents',
      title: 'Documents',
      description: 'Securely upload vehicle documents.',
      icon: '05',
    },
    {
      id: 'reports',
      title: 'Reports',
      description: 'Review fleet status and export data.',
      icon: '06',
    },
  ];
  return (
    <section className="dashboard-tiles" aria-label="Dashboard modules">
      {tiles.map((tile) => (
        <button
          className={`dashboard-tile${activeSection === tile.id ? ' selected' : ''}`}
          key={tile.id}
          type="button"
          onClick={() => onSelect(tile.id)}
        >
          <span className="tile-number">{tile.icon}</span>
          <strong>{tile.title}</strong>
          <span>{tile.description}</span>
        </button>
      ))}
    </section>
  );
}

function VehicleManager({ userId, canManage }: { userId: string; canManage: boolean }) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleRecord | null>(null);

  const loadVehicles = async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('vehicles')
      .select(
        'id, registration_number, make, model, vehicle_type, manufacturing_year, department, assigned_driver, fuel_type, status',
      )
      .order('registration_number');
    if (queryError) setError(queryError.message);
    else setVehicles((data ?? []) as VehicleRecord[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadVehicles();
  }, []);

  const setVehicleStatus = async (id: string, status: 'active' | 'archived') => {
    const { error: updateError } = await supabase.from('vehicles').update({ status }).eq('id', id);
    if (updateError) setError(updateError.message);
    else void loadVehicles();
  };

  return (
    <section className="fleet-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Fleet</p>
          <h2>Vehicles</h2>
        </div>
        {canManage && (
          <button type="button" onClick={() => setShowForm((visible) => !visible)}>
            {showForm ? 'Close' : 'Add vehicle'}
          </button>
        )}
      </div>
      {showForm && (
        <VehicleForm
          onSaved={() => {
            setShowForm(false);
            void loadVehicles();
          }}
        />
      )}
      {error && <p className="error-message">{error}</p>}
      {loading ? (
        <p>Loading vehicles...</p>
      ) : vehicles.length === 0 ? (
        <p className="empty-state">No vehicles have been registered yet.</p>
      ) : (
        <div className="vehicle-list">
          {vehicles.map((vehicle) => (
            <article className="vehicle-card" key={vehicle.id}>
              <button
                className="vehicle-summary"
                type="button"
                onClick={() => setSelectedVehicle(vehicle)}
              >
                <strong>{vehicle.registration_number}</strong>
                <p>
                  {vehicle.make} {vehicle.model} · {vehicle.vehicle_type}
                </p>
                <small>
                  {vehicle.department || 'No department'} · {vehicle.status}
                </small>
              </button>
              {canManage && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    void setVehicleStatus(
                      vehicle.id,
                      vehicle.status === 'active' ? 'archived' : 'active',
                    )
                  }
                >
                  {vehicle.status === 'active' ? 'Archive' : 'Restore'}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      {selectedVehicle && (
        <VehicleProfile
          vehicle={selectedVehicle}
          userId={userId}
          canManage={canManage}
          onClose={() => setSelectedVehicle(null)}
        />
      )}
    </section>
  );
}

function VehicleProfile({
  vehicle,
  userId,
  canManage,
  onClose,
}: {
  vehicle: VehicleRecord;
  userId: string;
  canManage: boolean;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [documents, setDocuments] = useState<
    Array<{
      id: string;
      document_type: string;
      reference_number: string | null;
      issue_date: string | null;
      expiry_date: string | null;
      file_path: string;
      signed_url: string;
    }>
  >([]);
  const [mileage, setMileage] = useState<
    Array<{ reading_date: string; odometer_reading: number; notes: string | null }>
  >([]);
  const [maintenance, setMaintenance] = useState<
    Array<{
      service_date: string;
      service_type: string;
      provider: string | null;
      cost: number | null;
    }>
  >([]);
  const [inspections, setInspections] = useState<
    Array<{ inspection_date: string; overall_condition: string; remarks: string | null }>
  >([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<(typeof documents)[number] | null>(null);
  const viewableDocuments = documents.filter(
    (document) => document.document_type !== 'Vehicle Photo',
  );

  const loadHistory = async () => {
    const [photoResult, mileageResult, maintenanceResult, inspectionResult] = await Promise.all([
      supabase
        .from('vehicle_documents')
        .select('id, document_type, reference_number, issue_date, expiry_date, file_path')
        .eq('vehicle_id', vehicle.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('mileage_records')
        .select('reading_date, odometer_reading, notes')
        .eq('vehicle_id', vehicle.id)
        .order('reading_date', { ascending: false }),
      supabase
        .from('maintenance_records')
        .select('service_date, service_type, provider, cost')
        .eq('vehicle_id', vehicle.id)
        .order('service_date', { ascending: false }),
      supabase
        .from('inspections')
        .select('inspection_date, overall_condition, remarks')
        .eq('vehicle_id', vehicle.id)
        .order('inspection_date', { ascending: false }),
    ]);
    const firstError =
      photoResult.error || mileageResult.error || maintenanceResult.error || inspectionResult.error;
    if (firstError) {
      setError(firstError.message);
      return;
    }
    const documentRecords = await Promise.all(
      (photoResult.data ?? []).map(async (document) => {
        const result = await supabase.storage
          .from('vehicle-documents')
          .createSignedUrl(document.file_path, 3600);
        return { ...document, signed_url: result.data?.signedUrl ?? '' };
      }),
    );
    setDocuments(documentRecords);
    setPhotos(
      documentRecords
        .filter((document) => document.document_type === 'Vehicle Photo' && document.signed_url)
        .map((document) => document.signed_url),
    );
    setMileage((mileageResult.data ?? []) as typeof mileage);
    setMaintenance((maintenanceResult.data ?? []) as typeof maintenance);
    setInspections((inspectionResult.data ?? []) as typeof inspections);
  };

  useEffect(() => {
    void loadHistory();
  }, [vehicle.id]);

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setError('Vehicle photos must be images smaller than 5 MB.');
      return;
    }
    setUploading(true);
    const path = `${vehicle.id}/photos/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('vehicle-documents')
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      setError(uploadError.message);
    } else {
      const { error: recordError } = await supabase.from('vehicle_documents').insert({
        vehicle_id: vehicle.id,
        document_type: 'Vehicle Photo',
        file_path: path,
        uploaded_by: userId,
      });
      if (recordError) setError(recordError.message);
      else void loadHistory();
    }
    setUploading(false);
  };

  const removeDocument = async (document: (typeof documents)[number]) => {
    if (!window.confirm(`Remove this ${document.document_type} document?`)) return;
    setError('');
    const { error: storageError } = await supabase.storage
      .from('vehicle-documents')
      .remove([document.file_path]);
    if (storageError) {
      setError(storageError.message);
      return;
    }
    const { error: recordError } = await supabase
      .from('vehicle_documents')
      .delete()
      .eq('id', document.id);
    if (recordError) {
      setError(recordError.message);
      return;
    }
    setDocuments((current) => current.filter((item) => item.id !== document.id));
    setPhotos((current) => current.filter((photo) => photo !== document.signed_url));
    setSelectedDocument(null);
  };

  const replaceDocument = async (document: (typeof documents)[number], file: File | undefined) => {
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (file.size > 10 * 1024 * 1024 || !allowed.includes(file.type)) {
      setError('Replacement files must be PDF, JPG, or PNG files no larger than 10 MB.');
      return;
    }
    setUploading(true);
    setError('');
    const path = `${vehicle.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('vehicle-documents')
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }
    const { error: recordError } = await supabase
      .from('vehicle_documents')
      .update({ file_path: path })
      .eq('id', document.id);
    if (recordError) {
      await supabase.storage.from('vehicle-documents').remove([path]);
      setError(recordError.message);
      setUploading(false);
      return;
    }
    const { error: cleanupError } = await supabase.storage
      .from('vehicle-documents')
      .remove([document.file_path]);
    if (cleanupError) {
      setError(
        `Document replaced, but the previous file could not be removed: ${cleanupError.message}`,
      );
    } else {
      setError('');
    }
    await loadHistory();
    setSelectedDocument(null);
    setUploading(false);
  };

  return (
    <div className="profile-backdrop">
      <section className="vehicle-profile" role="dialog" aria-modal="true">
        <button className="close-button" type="button" onClick={onClose}>
          Close
        </button>
        <p className="eyebrow">Vehicle profile</p>
        <h2>{vehicle.registration_number}</h2>
        <p className="profile-subtitle">
          {vehicle.make} {vehicle.model} · {vehicle.vehicle_type} · {vehicle.status}
        </p>
        {canManage && (
          <label className="photo-upload">
            Add vehicle photo
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(event) => void uploadPhoto(event.target.files?.[0])}
            />
          </label>
        )}
        {error && <p className="error-message">{error}</p>}
        <div className="photo-grid">
          {photos.length ? (
            photos.map((photo) => (
              <img key={photo} src={photo} alt={`${vehicle.registration_number} vehicle`} />
            ))
          ) : (
            <p className="empty-state">No vehicle photos uploaded.</p>
          )}
        </div>
        <button
          className="documents-toggle"
          type="button"
          onClick={() => setShowDocuments((visible) => !visible)}
        >
          {showDocuments ? 'Hide documents' : `View documents (${viewableDocuments.length})`}
        </button>
        {showDocuments && (
          <section className="document-list">
            <h3>Vehicle documents</h3>
            {viewableDocuments.length === 0 ? (
              <p className="empty-state">No documents uploaded.</p>
            ) : (
              viewableDocuments.map((document) => (
                <div className="document-row" key={document.id}>
                  <strong>{document.document_type}</strong>
                  <div className="document-actions">
                    <button
                      type="button"
                      disabled={!document.signed_url}
                      onClick={() => setSelectedDocument(document)}
                    >
                      View
                    </button>
                    {canManage && (
                      <>
                        <label className="document-replace-button">
                          Replace
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            disabled={uploading}
                            onChange={(event) => {
                              void replaceDocument(document, event.target.files?.[0]);
                              event.target.value = '';
                            }}
                          />
                        </label>
                        <button
                          className="danger-button"
                          type="button"
                          onClick={() => void removeDocument(document)}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>
        )}
        <div className="profile-history">
          <HistoryBlock title="Mileage" empty={mileage.length === 0}>
            {mileage.map((record) => (
              <li key={`${record.reading_date}-${record.odometer_reading}`}>
                {record.reading_date}: {record.odometer_reading.toLocaleString()} km
                {record.notes ? ` · ${record.notes}` : ''}
              </li>
            ))}
          </HistoryBlock>
          <HistoryBlock title="Maintenance" empty={maintenance.length === 0}>
            {maintenance.map((record) => (
              <li key={`${record.service_date}-${record.service_type}`}>
                {record.service_date}: {record.service_type}
                {record.provider ? ` · ${record.provider}` : ''}
                {record.cost ? ` · ${record.cost}` : ''}
              </li>
            ))}
          </HistoryBlock>
          <HistoryBlock title="Inspections" empty={inspections.length === 0}>
            {inspections.map((record) => (
              <li key={`${record.inspection_date}-${record.overall_condition}`}>
                {record.inspection_date}: {record.overall_condition}
                {record.remarks ? ` · ${record.remarks}` : ''}
              </li>
            ))}
          </HistoryBlock>
        </div>
      </section>
      {selectedDocument?.signed_url && (
        <div className="document-viewer-backdrop">
          <section className="document-viewer" role="dialog" aria-modal="true">
            <button
              className="close-button"
              type="button"
              onClick={() => setSelectedDocument(null)}
            >
              Close
            </button>
            <h2>{selectedDocument.document_type}</h2>
            <p className="document-meta">
              {selectedDocument.reference_number || 'No reference number'}
              {selectedDocument.expiry_date ? ` · Expires ${selectedDocument.expiry_date}` : ''}
            </p>
            {/\.(png|jpe?g|gif|webp)$/i.test(selectedDocument.file_path) ? (
              <img src={selectedDocument.signed_url} alt={selectedDocument.document_type} />
            ) : (
              <iframe src={selectedDocument.signed_url} title={selectedDocument.document_type} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function HistoryBlock({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="history-block">
      <h3>{title}</h3>
      {empty ? <p className="empty-state">No records yet.</p> : <ul>{children}</ul>}
    </section>
  );
}

function VehicleForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({
    registration_number: '',
    make: '',
    model: '',
    vehicle_type: '',
    manufacturing_year: String(currentYear),
    department: '',
    fuel_type: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('vehicles').insert({
      ...form,
      manufacturing_year: Number(form.manufacturing_year),
      registration_number: form.registration_number.trim().toUpperCase(),
    });
    if (insertError) setError(insertError.message);
    else onSaved();
    setSaving(false);
  };
  return (
    <form className="vehicle-form" onSubmit={save}>
      {(
        [
          'registration_number',
          'make',
          'model',
          'vehicle_type',
          'manufacturing_year',
          'department',
          'fuel_type',
        ] as const
      ).map((key) => (
        <label key={key}>
          {key.replaceAll('_', ' ')}
          <input
            value={form[key]}
            onChange={(event) => update(key, event.target.value)}
            required={[
              'registration_number',
              'make',
              'model',
              'vehicle_type',
              'manufacturing_year',
            ].includes(key)}
          />
        </label>
      ))}
      {error && <p className="error-message">{error}</p>}
      <button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save vehicle'}
      </button>
    </form>
  );
}

function OperationsPanel({ userId, canManage }: { userId: string; canManage: boolean }) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [message, setMessage] = useState('');
  const [mileage, setMileage] = useState({
    vehicle_id: '',
    odometer_reading: '',
    reading_date: '',
    notes: '',
  });
  const [inspection, setInspection] = useState({
    vehicle_id: '',
    inspection_date: '',
    week_start_date: '',
    odometer_reading: '',
    overall_condition: 'Good',
    remarks: '',
  });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('vehicles')
        .select(
          'id, registration_number, make, model, vehicle_type, manufacturing_year, department, assigned_driver, fuel_type, status',
        )
        .eq('status', 'active')
        .order('registration_number');
      setVehicles((data ?? []) as VehicleRecord[]);
    };
    void load();
  }, []);

  const saveMileage = async (event: FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.from('mileage_records').insert({
      ...mileage,
      recorded_by: userId,
      odometer_reading: Number(mileage.odometer_reading),
    });
    setMessage(error ? error.message : 'Mileage record saved.');
    if (!error) setMileage({ vehicle_id: '', odometer_reading: '', reading_date: '', notes: '' });
  };

  const saveInspection = async (event: FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.from('inspections').insert({
      ...inspection,
      inspector_id: userId,
      odometer_reading: Number(inspection.odometer_reading),
    });
    setMessage(error ? error.message : 'Weekly inspection saved.');
    if (!error) {
      setInspection({
        vehicle_id: '',
        inspection_date: '',
        week_start_date: '',
        odometer_reading: '',
        overall_condition: 'Good',
        remarks: '',
      });
    }
  };

  if (!canManage) {
    return (
      <section className="status-card">
        <div>
          <strong>Operations</strong>
          <p>Management access is read-only. Administrators record mileage and inspections.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="operations-section">
      <p className="eyebrow">Operations</p>
      <h2>Weekly records</h2>
      {message && (
        <p className={message.endsWith('.') ? 'success-message' : 'error-message'}>{message}</p>
      )}
      <div className="operations-grid">
        <form className="vehicle-form" onSubmit={saveMileage}>
          <strong>Record mileage</strong>
          <select
            required
            value={mileage.vehicle_id}
            onChange={(event) => setMileage({ ...mileage, vehicle_id: event.target.value })}
          >
            <option value="">Select vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registration_number}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            placeholder="Odometer reading"
            required
            value={mileage.odometer_reading}
            onChange={(event) => setMileage({ ...mileage, odometer_reading: event.target.value })}
          />
          <input
            type="date"
            required
            value={mileage.reading_date}
            onChange={(event) => setMileage({ ...mileage, reading_date: event.target.value })}
          />
          <input
            placeholder="Notes (optional)"
            value={mileage.notes}
            onChange={(event) => setMileage({ ...mileage, notes: event.target.value })}
          />
          <button type="submit">Save mileage</button>
        </form>
        <form className="vehicle-form" onSubmit={saveInspection}>
          <strong>Weekly inspection</strong>
          <select
            required
            value={inspection.vehicle_id}
            onChange={(event) => setInspection({ ...inspection, vehicle_id: event.target.value })}
          >
            <option value="">Select vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registration_number}
              </option>
            ))}
          </select>
          <input
            type="date"
            required
            value={inspection.inspection_date}
            onChange={(event) =>
              setInspection({ ...inspection, inspection_date: event.target.value })
            }
          />
          <input
            type="date"
            required
            value={inspection.week_start_date}
            onChange={(event) =>
              setInspection({ ...inspection, week_start_date: event.target.value })
            }
          />
          <input
            type="number"
            min="0"
            placeholder="Odometer reading"
            required
            value={inspection.odometer_reading}
            onChange={(event) =>
              setInspection({ ...inspection, odometer_reading: event.target.value })
            }
          />
          <input
            placeholder="Overall condition"
            required
            value={inspection.overall_condition}
            onChange={(event) =>
              setInspection({ ...inspection, overall_condition: event.target.value })
            }
          />
          <input
            placeholder="Remarks (optional)"
            value={inspection.remarks}
            onChange={(event) => setInspection({ ...inspection, remarks: event.target.value })}
          />
          <button type="submit">Save inspection</button>
        </form>
      </div>
    </section>
  );
}

function CompliancePanel({ canManage }: { canManage: boolean }) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [form, setForm] = useState({
    vehicle_id: '',
    compliance_type: 'Revenue Licence',
    issue_date: '',
    expiry_date: '',
    reference_number: '',
    status: 'valid',
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('vehicles')
        .select(
          'id, registration_number, make, model, vehicle_type, manufacturing_year, department, assigned_driver, fuel_type, status',
        )
        .order('registration_number');
      setVehicles((data ?? []) as VehicleRecord[]);
    };
    void load();
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.from('compliance_records').insert(form);
    setMessage(error ? error.message : 'Compliance record saved.');
    if (!error)
      setForm({ ...form, vehicle_id: '', issue_date: '', expiry_date: '', reference_number: '' });
  };

  return (
    <section className="operations-section">
      <p className="eyebrow">Compliance</p>
      <h2>Vehicle documents and renewals</h2>
      {!canManage ? (
        <p className="empty-state">
          Management can review compliance records. Administrators add renewals here.
        </p>
      ) : (
        <form className="vehicle-form compliance-form" onSubmit={save}>
          <select
            required
            value={form.vehicle_id}
            onChange={(event) => setForm({ ...form, vehicle_id: event.target.value })}
          >
            <option value="">Select vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registration_number}
              </option>
            ))}
          </select>
          <select
            value={form.compliance_type}
            onChange={(event) => setForm({ ...form, compliance_type: event.target.value })}
          >
            <option>Revenue Licence</option>
            <option>Emission Test</option>
            <option>Insurance</option>
          </select>
          <input
            type="date"
            required
            value={form.issue_date}
            onChange={(event) => setForm({ ...form, issue_date: event.target.value })}
          />
          <input
            type="date"
            required
            value={form.expiry_date}
            onChange={(event) => setForm({ ...form, expiry_date: event.target.value })}
          />
          <input
            placeholder="Reference number"
            value={form.reference_number}
            onChange={(event) => setForm({ ...form, reference_number: event.target.value })}
          />
          <select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
          >
            <option value="valid">Valid</option>
            <option value="pending">Pending</option>
            <option value="expired">Expired</option>
          </select>
          <button type="submit">Save compliance record</button>
          {message && (
            <p className={message.endsWith('.') ? 'success-message' : 'error-message'}>{message}</p>
          )}
        </form>
      )}
    </section>
  );
}

function MaintenancePanel({ canManage }: { canManage: boolean }) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    vehicle_id: '',
    service_date: '',
    odometer_reading: '',
    service_type: 'Preventive service',
    description: '',
    provider: '',
    cost: '',
    next_service_date: '',
    next_service_mileage: '',
  });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('vehicles')
        .select(
          'id, registration_number, make, model, vehicle_type, manufacturing_year, department, assigned_driver, fuel_type, status',
        );
      setVehicles((data ?? []) as VehicleRecord[]);
    };
    void load();
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.from('maintenance_records').insert({
      ...form,
      odometer_reading: Number(form.odometer_reading),
      cost: form.cost ? Number(form.cost) : null,
      next_service_mileage: form.next_service_mileage ? Number(form.next_service_mileage) : null,
      next_service_date: form.next_service_date || null,
    });
    setMessage(error ? error.message : 'Maintenance record saved.');
    if (!error)
      setForm({
        ...form,
        vehicle_id: '',
        service_date: '',
        odometer_reading: '',
        cost: '',
        next_service_date: '',
        next_service_mileage: '',
      });
  };

  return (
    <section className="operations-section">
      <p className="eyebrow">Maintenance</p>
      <h2>Service and repairs</h2>
      {!canManage ? (
        <p className="empty-state">
          Management can review maintenance history. Administrators record services here.
        </p>
      ) : (
        <form className="vehicle-form maintenance-form" onSubmit={save}>
          <select
            required
            value={form.vehicle_id}
            onChange={(event) => setForm({ ...form, vehicle_id: event.target.value })}
          >
            <option value="">Select vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registration_number}
              </option>
            ))}
          </select>
          <input
            type="date"
            required
            value={form.service_date}
            onChange={(event) => setForm({ ...form, service_date: event.target.value })}
          />
          <input
            type="number"
            min="0"
            placeholder="Odometer reading"
            required
            value={form.odometer_reading}
            onChange={(event) => setForm({ ...form, odometer_reading: event.target.value })}
          />
          <input
            placeholder="Service type"
            required
            value={form.service_type}
            onChange={(event) => setForm({ ...form, service_type: event.target.value })}
          />
          <input
            placeholder="Provider"
            value={form.provider}
            onChange={(event) => setForm({ ...form, provider: event.target.value })}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Cost"
            value={form.cost}
            onChange={(event) => setForm({ ...form, cost: event.target.value })}
          />
          <input
            type="date"
            value={form.next_service_date}
            onChange={(event) => setForm({ ...form, next_service_date: event.target.value })}
          />
          <input
            type="number"
            min="0"
            placeholder="Next service mileage"
            value={form.next_service_mileage}
            onChange={(event) => setForm({ ...form, next_service_mileage: event.target.value })}
          />
          <input
            placeholder="Description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
          <button type="submit">Save maintenance record</button>
          {message && (
            <p className={message.endsWith('.') ? 'success-message' : 'error-message'}>{message}</p>
          )}
        </form>
      )}
    </section>
  );
}

function DocumentsPanel({ userId, canManage }: { userId: string; canManage: boolean }) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [documentType, setDocumentType] = useState('Other');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('vehicles')
        .select(
          'id, registration_number, make, model, vehicle_type, manufacturing_year, department, assigned_driver, fuel_type, status',
        );
      setVehicles((data ?? []) as VehicleRecord[]);
    };
    void load();
  }, []);

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !vehicleId) return setMessage('Select a vehicle and file.');
    if (uniqueDocumentTypes.has(documentType)) {
      const { data: existing, error: lookupError } = await supabase
        .from('vehicle_documents')
        .select('id')
        .eq('vehicle_id', vehicleId)
        .eq('document_type', documentType)
        .limit(1);
      if (lookupError) return setMessage(lookupError.message);
      if (existing.length > 0) {
        return setMessage(`${documentType} already exists for this vehicle. Use Replace instead.`);
      }
    }
    if (file.size > 10 * 1024 * 1024) return setMessage('Files must be 10 MB or smaller.');
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type))
      return setMessage('Only PDF, JPG, and PNG files are supported.');
    const path = `${vehicleId}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('vehicle-documents')
      .upload(path, file, { contentType: file.type });
    if (uploadError) return setMessage(uploadError.message);
    const { error: recordError } = await supabase.from('vehicle_documents').insert({
      vehicle_id: vehicleId,
      document_type: documentType,
      expiry_date: expiryDate || null,
      file_path: path,
      uploaded_by: userId,
    });
    setMessage(recordError ? recordError.message : 'Document uploaded.');
  };

  return (
    <section className="operations-section">
      <p className="eyebrow">Documents</p>
      <h2>Vehicle documents</h2>
      {!canManage ? (
        <p className="empty-state">
          Management can review documents. Administrators upload files here.
        </p>
      ) : (
        <form className="vehicle-form document-form" onSubmit={upload}>
          <select required value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
            <option value="">Select vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registration_number}
              </option>
            ))}
          </select>
          <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
            <option>Revenue Licence</option>
            <option>Emission Test</option>
            <option>Insurance</option>
            <option>Other</option>
          </select>
          <input
            type="date"
            value={expiryDate}
            onChange={(event) => setExpiryDate(event.target.value)}
          />
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <button type="submit">Upload document</button>
          {message && (
            <p className={message.endsWith('.') ? 'success-message' : 'error-message'}>{message}</p>
          )}
        </form>
      )}
    </section>
  );
}

function ReportsPanel() {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select(
          'id, registration_number, make, model, vehicle_type, manufacturing_year, department, assigned_driver, fuel_type, status',
        )
        .order('registration_number');
      if (error) setMessage(error.message);
      else setVehicles((data ?? []) as VehicleRecord[]);
    };
    void load();
  }, []);

  const exportVehicleReport = async () => {
    const vehicle = vehicles.find((item) => item.id === selectedVehicleId);
    if (!vehicle) {
      setMessage('Select a vehicle before exporting.');
      return;
    }
    setExporting(true);
    setMessage('');
    const [mileage, inspections, compliance, maintenance] = await Promise.all([
      supabase
        .from('mileage_records')
        .select('reading_date, odometer_reading, notes')
        .eq('vehicle_id', vehicle.id)
        .order('reading_date'),
      supabase
        .from('inspections')
        .select('inspection_date, week_start_date, odometer_reading, overall_condition, remarks')
        .eq('vehicle_id', vehicle.id)
        .order('inspection_date'),
      supabase
        .from('compliance_records')
        .select(
          'compliance_type, issue_date, expiry_date, completion_date, reference_number, status',
        )
        .eq('vehicle_id', vehicle.id)
        .order('expiry_date'),
      supabase
        .from('maintenance_records')
        .select(
          'service_date, odometer_reading, service_type, description, provider, cost, next_service_date, next_service_mileage',
        )
        .eq('vehicle_id', vehicle.id)
        .order('service_date'),
    ]);
    const failed = [mileage, inspections, compliance, maintenance].find((result) => result.error);
    if (failed?.error) {
      setMessage(failed.error.message);
      setExporting(false);
      return;
    }
    const csvValue = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const lines: string[] = [];
    const addSection = (title: string, columns: string[], rows: unknown[][]) => {
      lines.push(title, columns.map(csvValue).join(','));
      rows.forEach((row) => lines.push(row.map(csvValue).join(',')));
      lines.push('');
    };
    addSection(
      'Vehicle details',
      [
        'Registration',
        'Make',
        'Model',
        'Vehicle type',
        'Manufacturing year',
        'Department',
        'Assigned driver',
        'Fuel type',
        'Status',
      ],
      [
        [
          vehicle.registration_number,
          vehicle.make,
          vehicle.model,
          vehicle.vehicle_type,
          vehicle.manufacturing_year,
          vehicle.department,
          vehicle.assigned_driver,
          vehicle.fuel_type,
          vehicle.status,
        ],
      ],
    );
    addSection(
      'Mileage history',
      ['Reading date', 'Odometer reading', 'Notes'],
      (mileage.data ?? []).map((record) => [
        record.reading_date,
        record.odometer_reading,
        record.notes,
      ]),
    );
    addSection(
      'Service history',
      [
        'Service date',
        'Odometer reading',
        'Service type',
        'Description',
        'Provider',
        'Cost',
        'Next service date',
        'Next service mileage',
      ],
      (maintenance.data ?? []).map((record) => [
        record.service_date,
        record.odometer_reading,
        record.service_type,
        record.description,
        record.provider,
        record.cost,
        record.next_service_date,
        record.next_service_mileage,
      ]),
    );
    addSection(
      'Inspection history',
      ['Inspection date', 'Week start date', 'Odometer reading', 'Overall condition', 'Remarks'],
      (inspections.data ?? []).map((record) => [
        record.inspection_date,
        record.week_start_date,
        record.odometer_reading,
        record.overall_condition,
        record.remarks,
      ]),
    );
    addSection(
      'Compliance history',
      [
        'Compliance type',
        'Issue date',
        'Expiry date',
        'Completion date',
        'Reference number',
        'Status',
      ],
      (compliance.data ?? []).map((record) => [
        record.compliance_type,
        record.issue_date,
        record.expiry_date,
        record.completion_date,
        record.reference_number,
        record.status,
      ]),
    );
    const csv = lines.join('\n');
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.href = url;
    link.download = `riyon-${vehicle.registration_number}-vehicle-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  return (
    <section className="operations-section">
      <p className="eyebrow">Reports</p>
      <h2>Fleet overview</h2>
      <div className="report-grid">
        <div className="report-card">
          <strong>{vehicles.length}</strong>
          <span>Total vehicles</span>
        </div>
        <div className="report-card">
          <strong>{vehicles.filter((vehicle) => vehicle.status === 'active').length}</strong>
          <span>Active</span>
        </div>
        <div className="report-card">
          <strong>{vehicles.filter((vehicle) => vehicle.status === 'archived').length}</strong>
          <span>Archived</span>
        </div>
      </div>
      <select
        value={selectedVehicleId}
        onChange={(event) => setSelectedVehicleId(event.target.value)}
      >
        <option value="">Select vehicle for report</option>
        {vehicles.map((vehicle) => (
          <option key={vehicle.id} value={vehicle.id}>
            {vehicle.registration_number} · {vehicle.make} {vehicle.model}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => void exportVehicleReport()} disabled={exporting}>
        {exporting ? 'Preparing vehicle report...' : 'Export selected vehicle report'}
      </button>
      {message && <p className="error-message">{message}</p>}
    </section>
  );
}

function Login({ error, onError }: { error: string; onError: (message: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    onError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) onError(signInError.message);
    setSubmitting(false);
  };

  return (
    <main>
      <div className="login-brand">
        <img src="/riyon-logo.png" alt="Riyon International logo" />
      </div>
      <h1>{config.appName}</h1>
      <p className="intro login-product-title">Vehicle Management System</p>
      <form className="login-card" onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && <p className="error-message">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

export default App;
