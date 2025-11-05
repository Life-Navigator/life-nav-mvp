import { db as prisma } from "@/lib/db";
import { encryptObjectFields, decryptObjectFields } from "@/lib/encryption/model-encryption";

// Define sensitive fields for each model
const HEALTH_RECORD_SENSITIVE_FIELDS = ['bloodType', 'allergies', 'medications'] as const;
const VITAL_SIGN_SENSITIVE_FIELDS = ['value', 'notes'] as const;
const APPOINTMENT_SENSITIVE_FIELDS = ['reason', 'notes'] as const;

// Health record types
export interface CreateHealthRecordInput {
  userId: string;
  height?: number;
  weight?: number;
  bloodType?: string;
  allergies?: string;
  medications?: string;
}

export interface UpdateHealthRecordInput {
  height?: number;
  weight?: number;
  bloodType?: string;
  allergies?: string;
  medications?: string;
}

// Vital sign types
export interface CreateVitalSignInput {
  healthRecordId: string;
  type: string;
  value: string;
  unit: string;
  recordedAt: Date;
  notes?: string;
}

export interface UpdateVitalSignInput {
  type?: string;
  value?: string;
  unit?: string;
  recordedAt?: Date;
  notes?: string;
}

// Medical appointment types
export interface CreateMedicalAppointmentInput {
  healthRecordId: string;
  doctor: string;
  specialty?: string;
  date: Date;
  reason?: string;
  notes?: string;
  completed?: boolean;
}

export interface UpdateMedicalAppointmentInput {
  doctor?: string;
  specialty?: string;
  date?: Date;
  reason?: string;
  notes?: string;
  completed?: boolean;
}

export const healthService = {
  // Health Records
  async getHealthRecord(userId: string) {
    const record = await prisma.healthRecord.findFirst({
      where: { userId },
      include: {
        vitalSigns: {
          orderBy: { recordedAt: 'desc' },
        },
        appointments: {
          orderBy: { date: 'asc' },
        },
      },
    });
    
    // No need to decrypt manually if Prisma middleware is active
    // This serves as a fallback if middleware isn't enabled
    if (record && process.env.ENABLE_FIELD_ENCRYPTION !== 'true') {
      // Decrypt sensitive fields in the main record
      const decryptedRecord = decryptObjectFields(
        record, 
        'HealthRecord', 
        HEALTH_RECORD_SENSITIVE_FIELDS
      );
      
      // Decrypt sensitive fields in vital signs
      if (decryptedRecord.vitalSigns) {
        decryptedRecord.vitalSigns = decryptedRecord.vitalSigns.map(sign => 
          decryptObjectFields(sign, 'VitalSign', VITAL_SIGN_SENSITIVE_FIELDS)
        );
      }
      
      // Decrypt sensitive fields in appointments
      if (decryptedRecord.appointments) {
        decryptedRecord.appointments = decryptedRecord.appointments.map(appointment => 
          decryptObjectFields(appointment, 'MedicalAppointment', APPOINTMENT_SENSITIVE_FIELDS)
        );
      }
      
      return decryptedRecord;
    }
    
    return record;
  },
  
  async createHealthRecord(data: CreateHealthRecordInput) {
    // Encrypt sensitive fields before saving
    // Only needed if Prisma middleware isn't enabled
    const dataToSave = process.env.ENABLE_FIELD_ENCRYPTION !== 'true' 
      ? encryptObjectFields(data, 'HealthRecord', HEALTH_RECORD_SENSITIVE_FIELDS)
      : data;
    
    const record = await prisma.healthRecord.create({
      data: dataToSave,
      include: {
        vitalSigns: true,
        appointments: true,
      },
    });
    
    // Decrypt response if needed (if middleware isn't enabled)
    if (record && process.env.ENABLE_FIELD_ENCRYPTION !== 'true') {
      return decryptObjectFields(record, 'HealthRecord', HEALTH_RECORD_SENSITIVE_FIELDS);
    }
    
    return record;
  },
  
  async updateHealthRecord(id: string, data: UpdateHealthRecordInput) {
    // Encrypt sensitive fields before saving
    // Only needed if Prisma middleware isn't enabled
    const dataToSave = process.env.ENABLE_FIELD_ENCRYPTION !== 'true' 
      ? encryptObjectFields(data, 'HealthRecord', HEALTH_RECORD_SENSITIVE_FIELDS)
      : data;
    
    const record = await prisma.healthRecord.update({
      where: { id },
      data: dataToSave,
      include: {
        vitalSigns: true,
        appointments: true,
      },
    });
    
    // Decrypt response if needed
    if (record && process.env.ENABLE_FIELD_ENCRYPTION !== 'true') {
      // Decrypt sensitive fields in the main record
      const decryptedRecord = decryptObjectFields(
        record, 
        'HealthRecord', 
        HEALTH_RECORD_SENSITIVE_FIELDS
      );
      
      // Decrypt sensitive fields in vital signs
      if (decryptedRecord.vitalSigns) {
        decryptedRecord.vitalSigns = decryptedRecord.vitalSigns.map(sign => 
          decryptObjectFields(sign, 'VitalSign', VITAL_SIGN_SENSITIVE_FIELDS)
        );
      }
      
      // Decrypt sensitive fields in appointments
      if (decryptedRecord.appointments) {
        decryptedRecord.appointments = decryptedRecord.appointments.map(appointment => 
          decryptObjectFields(appointment, 'MedicalAppointment', APPOINTMENT_SENSITIVE_FIELDS)
        );
      }
      
      return decryptedRecord;
    }
    
    return record;
  },
  
  // Vital Signs
  async getVitalSigns(healthRecordId: string) {
    const vitalSigns = await prisma.vitalSign.findMany({
      where: { healthRecordId },
      orderBy: { recordedAt: 'desc' },
    });
    
    // Decrypt if middleware isn't active
    if (process.env.ENABLE_FIELD_ENCRYPTION !== 'true' && vitalSigns.length > 0) {
      return vitalSigns.map(sign => 
        decryptObjectFields(sign, 'VitalSign', VITAL_SIGN_SENSITIVE_FIELDS)
      );
    }
    
    return vitalSigns;
  },
  
  async getVitalSignsByType(healthRecordId: string, type: string) {
    const vitalSigns = await prisma.vitalSign.findMany({
      where: { 
        healthRecordId,
        type,
      },
      orderBy: { recordedAt: 'desc' },
    });
    
    // Decrypt if middleware isn't active
    if (process.env.ENABLE_FIELD_ENCRYPTION !== 'true' && vitalSigns.length > 0) {
      return vitalSigns.map(sign => 
        decryptObjectFields(sign, 'VitalSign', VITAL_SIGN_SENSITIVE_FIELDS)
      );
    }
    
    return vitalSigns;
  },
  
  async createVitalSign(data: CreateVitalSignInput) {
    // Encrypt sensitive fields if middleware isn't active
    const dataToSave = process.env.ENABLE_FIELD_ENCRYPTION !== 'true'
      ? encryptObjectFields(data, 'VitalSign', VITAL_SIGN_SENSITIVE_FIELDS)
      : data;
    
    const vitalSign = await prisma.vitalSign.create({
      data: dataToSave,
    });
    
    // Decrypt response if middleware isn't active
    if (process.env.ENABLE_FIELD_ENCRYPTION !== 'true') {
      return decryptObjectFields(vitalSign, 'VitalSign', VITAL_SIGN_SENSITIVE_FIELDS);
    }
    
    return vitalSign;
  },
  
  async updateVitalSign(id: string, data: UpdateVitalSignInput) {
    // Encrypt sensitive fields if middleware isn't active
    const dataToSave = process.env.ENABLE_FIELD_ENCRYPTION !== 'true'
      ? encryptObjectFields(data, 'VitalSign', VITAL_SIGN_SENSITIVE_FIELDS)
      : data;
    
    const vitalSign = await prisma.vitalSign.update({
      where: { id },
      data: dataToSave,
    });
    
    // Decrypt response if middleware isn't active
    if (process.env.ENABLE_FIELD_ENCRYPTION !== 'true') {
      return decryptObjectFields(vitalSign, 'VitalSign', VITAL_SIGN_SENSITIVE_FIELDS);
    }
    
    return vitalSign;
  },
  
  async deleteVitalSign(id: string) {
    await prisma.vitalSign.delete({
      where: { id },
    });
    
    return true;
  },
  
  // Medical Appointments
  async getMedicalAppointments(healthRecordId: string) {
    const appointments = await prisma.medicalAppointment.findMany({
      where: { healthRecordId },
      orderBy: { date: 'asc' },
    });
    
    // Decrypt if middleware isn't active
    if (process.env.ENABLE_FIELD_ENCRYPTION !== 'true' && appointments.length > 0) {
      return appointments.map(appointment => 
        decryptObjectFields(appointment, 'MedicalAppointment', APPOINTMENT_SENSITIVE_FIELDS)
      );
    }
    
    return appointments;
  },
  
  async getUpcomingAppointments(healthRecordId: string) {
    const now = new Date();
    
    const appointments = await prisma.medicalAppointment.findMany({
      where: { 
        healthRecordId,
        date: { gte: now },
        completed: false,
      },
      orderBy: { date: 'asc' },
    });
    
    // Decrypt if middleware isn't active
    if (process.env.ENABLE_FIELD_ENCRYPTION !== 'true' && appointments.length > 0) {
      return appointments.map(appointment => 
        decryptObjectFields(appointment, 'MedicalAppointment', APPOINTMENT_SENSITIVE_FIELDS)
      );
    }
    
    return appointments;
  },
  
  async getMedicalAppointmentById(id: string) {
    const appointment = await prisma.medicalAppointment.findUnique({
      where: { id },
    });
    
    // Decrypt if middleware isn't active
    if (appointment && process.env.ENABLE_FIELD_ENCRYPTION !== 'true') {
      return decryptObjectFields(appointment, 'MedicalAppointment', APPOINTMENT_SENSITIVE_FIELDS);
    }
    
    return appointment;
  },
  
  async createMedicalAppointment(data: CreateMedicalAppointmentInput) {
    // Encrypt sensitive fields if middleware isn't active
    const dataToSave = process.env.ENABLE_FIELD_ENCRYPTION !== 'true'
      ? encryptObjectFields(data, 'MedicalAppointment', APPOINTMENT_SENSITIVE_FIELDS)
      : data;
    
    const appointment = await prisma.medicalAppointment.create({
      data: dataToSave,
    });
    
    // Decrypt response if middleware isn't active
    if (process.env.ENABLE_FIELD_ENCRYPTION !== 'true') {
      return decryptObjectFields(appointment, 'MedicalAppointment', APPOINTMENT_SENSITIVE_FIELDS);
    }
    
    return appointment;
  },
  
  async updateMedicalAppointment(id: string, data: UpdateMedicalAppointmentInput) {
    // Encrypt sensitive fields if middleware isn't active
    const dataToSave = process.env.ENABLE_FIELD_ENCRYPTION !== 'true'
      ? encryptObjectFields(data, 'MedicalAppointment', APPOINTMENT_SENSITIVE_FIELDS)
      : data;
    
    const appointment = await prisma.medicalAppointment.update({
      where: { id },
      data: dataToSave,
    });
    
    // Decrypt response if middleware isn't active
    if (process.env.ENABLE_FIELD_ENCRYPTION !== 'true') {
      return decryptObjectFields(appointment, 'MedicalAppointment', APPOINTMENT_SENSITIVE_FIELDS);
    }
    
    return appointment;
  },
  
  async deleteMedicalAppointment(id: string) {
    await prisma.medicalAppointment.delete({
      where: { id },
    });
    
    return true;
  },
};