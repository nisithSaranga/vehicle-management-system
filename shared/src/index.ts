export type UserRole = 'administrator' | 'management';

export type VehicleStatus = 'active' | 'archived';

export interface Vehicle {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  status: VehicleStatus;
}

export interface VehicleRecord {
  id: string;
  registration_number: string;
  make: string;
  model: string;
  vehicle_type: string;
  manufacturing_year: number;
  department: string | null;
  assigned_driver: string | null;
  fuel_type: string | null;
  status: VehicleStatus;
}

export interface AppConfig {
  appName: string;
  version: string;
}
