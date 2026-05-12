import { Injectable } from '@angular/core';
import { createClient, RealtimeChannel, Session, SupabaseClient } from '@supabase/supabase-js';

import { environment } from '../../environments/environment';
import {
  AppSettings,
  AttendanceEntry,
  AttendanceType,
  createWeeklyShiftTemplate,
  DailySale,
  PersonRole,
  StaffMember,
  WeekdayKey,
  WeeklyShiftTemplate,
} from '../models/store.models';

interface StaffMemberRow {
  id: string;
  user_id: string | null;
  full_name: string;
  role: PersonRole;
  is_active: boolean | null;
  default_daily_hours: number | null;
  weekly_schedule: WeeklyShiftTemplate | null;
  created_at: string;
}

interface DailySaleRow {
  id: string;
  user_id: string | null;
  sale_date: string;
  staff_member_id: string;
  regular_amount: number;
  test_amount: number;
  notes: string | null;
  created_at: string;
}

interface AttendanceEntryRow {
  id: string;
  user_id: string | null;
  staff_member_id: string;
  entry_date: string;
  entry_type: AttendanceType;
  worked_hours: number;
  notes: string | null;
  created_at: string;
}

interface AppSettingsRow {
  id: string;
  company_closure_days: WeekdayKey[] | null;
}

@Injectable({
  providedIn: 'root',
})
export class StoreService {
  private readonly staffStorageKey = 'goldfinger-manager-staff';
  private readonly salesStorageKey = 'goldfinger-manager-sales';
  private readonly attendanceStorageKey = 'goldfinger-manager-attendance';
  private readonly settingsStorageKey = 'goldfinger-manager-settings';
  private readonly supabase: SupabaseClient | null;
  private isRemoteAvailable: boolean;
  private currentUserId: string | null = null;
  private dataChangesChannel: RealtimeChannel | null = null;

  constructor() {
    this.supabase =
      environment.supabaseUrl && environment.supabaseAnonKey
        ? createClient(environment.supabaseUrl, environment.supabaseAnonKey)
        : null;
    this.isRemoteAvailable = !!this.supabase;
  }

  get storageMode(): 'supabase' | 'local' {
    return this.supabase && this.isRemoteAvailable ? 'supabase' : 'local';
  }

  async getSession(): Promise<Session | null> {
    if (!this.supabase) {
      return null;
    }

    const { data, error } = await this.supabase.auth.getSession();

    if (error) {
      throw this.buildAuthError(error.message);
    }

    this.currentUserId = data.session?.user.id ?? null;
    return data.session;
  }

  onAuthStateChange(callback: (session: Session | null) => void): { unsubscribe: () => void } {
    if (!this.supabase) {
      return {
        unsubscribe: () => undefined,
      };
    }

    const {
      data: { subscription },
    } = this.supabase.auth.onAuthStateChange((_, session) => {
      this.currentUserId = session?.user.id ?? null;
      callback(session);
    });

    return subscription;
  }

  async signIn(email: string, password: string): Promise<void> {
    if (!this.supabase) {
      throw new Error('Configura Supabase per attivare il login.');
    }

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      throw this.buildAuthError(error.message);
    }

    this.currentUserId = data.user?.id ?? this.currentUserId;
  }

  async signUp(email: string, password: string): Promise<{ needsEmailConfirmation: boolean }> {
    if (!this.supabase) {
      throw new Error('Configura Supabase per attivare il login.');
    }

    const { data, error } = await this.supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      throw this.buildAuthError(error.message);
    }

    this.currentUserId = data.user?.id ?? data.session?.user.id ?? this.currentUserId;

    return {
      needsEmailConfirmation: !data.session,
    };
  }

  async signOut(): Promise<void> {
    if (!this.supabase) {
      return;
    }

    this.unsubscribeFromDataChanges();

    const { error } = await this.supabase.auth.signOut();

    if (error) {
      throw this.buildAuthError(error.message);
    }

    this.currentUserId = null;
  }

  async subscribeToDataChanges(callback: () => void): Promise<{ unsubscribe: () => void }> {
    if (!this.supabase || !this.isRemoteAvailable) {
      return {
        unsubscribe: () => undefined,
      };
    }

    const userId = await this.getCurrentUserId();
    this.unsubscribeFromDataChanges();

    const channel = this.supabase.channel(`goldfinger-manager-sync-${userId}`);
    const handleChange = () => {
      callback();
    };

    channel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'staff_members',
        filter: `user_id=eq.${userId}`,
      }, handleChange)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'daily_sales',
        filter: `user_id=eq.${userId}`,
      }, handleChange)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance_entries',
        filter: `user_id=eq.${userId}`,
      }, handleChange)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'app_settings',
        filter: 'id=eq.global',
      }, handleChange)
      .subscribe();

    this.dataChangesChannel = channel;

    return {
      unsubscribe: () => {
        this.unsubscribeFromDataChanges(channel);
      },
    };
  }

  async getAppSettings(): Promise<AppSettings> {
    if (!this.supabase || !this.isRemoteAvailable) {
      return this.readLocalSettings();
    }

    const { data, error } = await this.supabase.from('app_settings').select('*').eq('id', 'global').maybeSingle();

    if (error) {
      this.handleSupabaseError('Errore durante il caricamento delle impostazioni aziendali da Supabase.', error);
      return this.readLocalSettings();
    }

    if (!data) {
      return this.readLocalSettings();
    }

    return {
      companyClosureDays: this.normalizeClosureDays((data as AppSettingsRow).company_closure_days),
    };
  }

  async updateAppSettings(settings: AppSettings): Promise<void> {
    const normalizedSettings = {
      companyClosureDays: this.normalizeClosureDays(settings.companyClosureDays),
    };

    if (!this.supabase || !this.isRemoteAvailable) {
      this.writeLocalSettings(normalizedSettings);
      return;
    }

    const { error } = await this.supabase.from('app_settings').upsert({
      id: 'global',
      company_closure_days: normalizedSettings.companyClosureDays,
    });

    if (error) {
      this.handleSupabaseError('Errore durante il salvataggio delle impostazioni aziendali su Supabase.', error);
      this.writeLocalSettings(normalizedSettings);
    }
  }

  async getStaffMembers(): Promise<StaffMember[]> {
    const userId = await this.getCurrentUserId();

    if (!this.supabase || !this.isRemoteAvailable) {
      return this.readLocalStaff(userId);
    }

    const { data, error } = await this.supabase
      .from('staff_members')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      this.handleSupabaseError('Errore durante il caricamento del personale da Supabase.', error);
      return this.readLocalStaff(userId);
    }

    return (data as StaffMemberRow[]).map((row) => this.mapStaffMemberRow(row));
  }

  async createStaffMember(
    fullName: string,
    role: PersonRole,
    defaultDailyHours: number,
    weeklySchedule: WeeklyShiftTemplate,
  ): Promise<StaffMember> {
    const userId = await this.getCurrentUserId();
    const staffMember: StaffMember = {
      id: crypto.randomUUID(),
      fullName: fullName.trim(),
      role,
      isActive: true,
      defaultDailyHours,
      weeklySchedule: this.normalizeWeeklySchedule(weeklySchedule, defaultDailyHours),
      createdAt: new Date().toISOString(),
    };

    if (!this.supabase || !this.isRemoteAvailable) {
      const staff = this.readLocalStaff(userId);
      staff.push(staffMember);
      this.writeLocalStaff(userId, staff);
      return staffMember;
    }

    const { error } = await this.supabase.from('staff_members').insert({
      id: staffMember.id,
      user_id: userId,
      full_name: staffMember.fullName,
      role: staffMember.role,
      is_active: staffMember.isActive,
      default_daily_hours: staffMember.defaultDailyHours,
      weekly_schedule: staffMember.weeklySchedule,
      created_at: staffMember.createdAt,
    });

    if (error) {
      this.handleSupabaseError('Errore durante il salvataggio del personale su Supabase.', error);
      const staff = this.readLocalStaff(userId);
      staff.push(staffMember);
      this.writeLocalStaff(userId, staff);
    }

    return staffMember;
  }

  async deleteStaffMember(staffMemberId: string): Promise<void> {
    const userId = await this.getCurrentUserId();

    if (!this.supabase || !this.isRemoteAvailable) {
      const staff = this.readLocalStaff(userId).filter((member) => member.id !== staffMemberId);
      this.writeLocalStaff(userId, staff);
      return;
    }

    const { error } = await this.supabase.from('staff_members').delete().eq('id', staffMemberId).eq('user_id', userId);

    if (error) {
      this.handleSupabaseError('Errore durante la cancellazione del personale da Supabase.', error);
    }
  }

  async updateStaffMemberVisibility(staffMemberId: string, isActive: boolean): Promise<void> {
    const userId = await this.getCurrentUserId();

    if (!this.supabase || !this.isRemoteAvailable) {
      const staff = this.readLocalStaff(userId).map((member) =>
        member.id === staffMemberId ? { ...member, isActive } : member,
      );
      this.writeLocalStaff(userId, staff);
      return;
    }

    const { error } = await this.supabase
      .from('staff_members')
      .update({ is_active: isActive })
      .eq('id', staffMemberId)
      .eq('user_id', userId);

    if (error) {
      this.handleSupabaseError('Errore durante l\'aggiornamento del personale.', error);
      const staff = this.readLocalStaff(userId).map((member) =>
        member.id === staffMemberId ? { ...member, isActive } : member,
      );
      this.writeLocalStaff(userId, staff);
    }
  }

  async updateStaffMemberSettings(payload: {
    staffMemberId: string;
    fullName: string;
    role: PersonRole;
    defaultDailyHours: number;
    weeklySchedule: WeeklyShiftTemplate;
  }): Promise<void> {
    const userId = await this.getCurrentUserId();

    if (!this.supabase || !this.isRemoteAvailable) {
      const staff = this.readLocalStaff(userId).map((member) =>
        member.id === payload.staffMemberId
          ? {
              ...member,
              fullName: payload.fullName,
              role: payload.role,
              defaultDailyHours: payload.defaultDailyHours,
              weeklySchedule: this.normalizeWeeklySchedule(payload.weeklySchedule, payload.defaultDailyHours),
            }
          : member,
      );
      this.writeLocalStaff(userId, staff);
      return;
    }

    const { error } = await this.supabase
      .from('staff_members')
      .update({
        full_name: payload.fullName,
        role: payload.role,
        default_daily_hours: payload.defaultDailyHours,
        weekly_schedule: this.normalizeWeeklySchedule(payload.weeklySchedule, payload.defaultDailyHours),
      })
      .eq('id', payload.staffMemberId)
      .eq('user_id', userId);

    if (error) {
      this.handleSupabaseError('Errore durante l\'aggiornamento delle impostazioni del personale.', error);
      const staff = this.readLocalStaff(userId).map((member) =>
        member.id === payload.staffMemberId
          ? {
              ...member,
              fullName: payload.fullName,
              role: payload.role,
              defaultDailyHours: payload.defaultDailyHours,
              weeklySchedule: this.normalizeWeeklySchedule(payload.weeklySchedule, payload.defaultDailyHours),
            }
          : member,
      );
      this.writeLocalStaff(userId, staff);
    }
  }

  async getDailySales(): Promise<DailySale[]> {
    const userId = await this.getCurrentUserId();

    if (!this.supabase || !this.isRemoteAvailable) {
      return this.readLocalSales(userId);
    }

    const { data, error } = await this.supabase
      .from('daily_sales')
      .select('*')
      .eq('user_id', userId)
      .order('sale_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      this.handleSupabaseError('Errore durante il caricamento degli incassi da Supabase.', error);
      return this.readLocalSales(userId);
    }

    return (data as DailySaleRow[]).map((row) => this.mapDailySaleRow(row));
  }

  async createDailySale(payload: {
    saleDate: string;
    staffMemberId: string;
    regularAmount: number;
    testAmount: number;
    notes: string;
  }): Promise<DailySale> {
    const userId = await this.getCurrentUserId();
    const dailySale: DailySale = {
      id: crypto.randomUUID(),
      saleDate: payload.saleDate,
      staffMemberId: payload.staffMemberId,
      regularAmount: payload.regularAmount,
      testAmount: payload.testAmount,
      notes: payload.notes.trim(),
      createdAt: new Date().toISOString(),
    };

    if (!this.supabase || !this.isRemoteAvailable) {
      const sales = this.readLocalSales(userId);
      sales.push(dailySale);
      this.writeLocalSales(userId, sales);
      return dailySale;
    }

    const { error } = await this.supabase.from('daily_sales').insert({
      id: dailySale.id,
      user_id: userId,
      sale_date: dailySale.saleDate,
      staff_member_id: dailySale.staffMemberId,
      regular_amount: dailySale.regularAmount,
      test_amount: dailySale.testAmount,
      notes: dailySale.notes || null,
      created_at: dailySale.createdAt,
    });

    if (error) {
      this.handleSupabaseError('Errore durante il salvataggio dell\'incasso su Supabase.', error);
      const sales = this.readLocalSales(userId);
      sales.push(dailySale);
      this.writeLocalSales(userId, sales);
    }

    return dailySale;
  }

  async deleteDailySale(saleId: string): Promise<void> {
    const userId = await this.getCurrentUserId();

    if (!this.supabase || !this.isRemoteAvailable) {
      const sales = this.readLocalSales(userId).filter((sale) => sale.id !== saleId);
      this.writeLocalSales(userId, sales);
      return;
    }

    const { error } = await this.supabase.from('daily_sales').delete().eq('id', saleId).eq('user_id', userId);

    if (error) {
      this.handleSupabaseError('Errore durante la cancellazione dell\'incasso da Supabase.', error);
    }
  }

  async getAttendanceEntries(): Promise<AttendanceEntry[]> {
    const userId = await this.getCurrentUserId();

    if (!this.supabase || !this.isRemoteAvailable) {
      return this.readLocalAttendance(userId);
    }

    const { data, error } = await this.supabase
      .from('attendance_entries')
      .select('*')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      this.handleSupabaseError('Errore durante il caricamento delle presenze da Supabase.', error);
      return this.readLocalAttendance(userId);
    }

    return (data as AttendanceEntryRow[]).map((row) => this.mapAttendanceEntryRow(row));
  }

  async createAttendanceEntry(payload: {
    staffMemberId: string;
    entryDate: string;
    entryType: AttendanceType;
    workedHours: number;
    notes: string;
  }): Promise<AttendanceEntry> {
    const userId = await this.getCurrentUserId();
    const attendanceEntry: AttendanceEntry = {
      id: crypto.randomUUID(),
      staffMemberId: payload.staffMemberId,
      entryDate: payload.entryDate,
      entryType: payload.entryType,
      workedHours: payload.workedHours,
      notes: payload.notes.trim(),
      createdAt: new Date().toISOString(),
    };

    if (!this.supabase || !this.isRemoteAvailable) {
      const attendanceEntries = this.readLocalAttendance(userId);
      attendanceEntries.push(attendanceEntry);
      this.writeLocalAttendance(userId, attendanceEntries);
      return attendanceEntry;
    }

    const { error } = await this.supabase.from('attendance_entries').insert({
      id: attendanceEntry.id,
      user_id: userId,
      staff_member_id: attendanceEntry.staffMemberId,
      entry_date: attendanceEntry.entryDate,
      entry_type: attendanceEntry.entryType,
      worked_hours: attendanceEntry.workedHours,
      notes: attendanceEntry.notes || null,
      created_at: attendanceEntry.createdAt,
    });

    if (error) {
      this.handleSupabaseError('Errore durante il salvataggio della presenza su Supabase.', error);
      const attendanceEntries = this.readLocalAttendance(userId);
      attendanceEntries.push(attendanceEntry);
      this.writeLocalAttendance(userId, attendanceEntries);
    }

    return attendanceEntry;
  }

  async updateAttendanceEntry(payload: {
    attendanceEntryId: string;
    staffMemberId: string;
    entryDate: string;
    entryType: AttendanceType;
    workedHours: number;
    notes: string;
  }): Promise<void> {
    const userId = await this.getCurrentUserId();

    if (!this.supabase || !this.isRemoteAvailable) {
      const attendanceEntries = this.readLocalAttendance(userId).map((entry) =>
        entry.id === payload.attendanceEntryId
          ? {
              ...entry,
              staffMemberId: payload.staffMemberId,
              entryDate: payload.entryDate,
              entryType: payload.entryType,
              workedHours: payload.workedHours,
              notes: payload.notes.trim(),
            }
          : entry,
      );
      this.writeLocalAttendance(userId, attendanceEntries);
      return;
    }

    const { error } = await this.supabase
      .from('attendance_entries')
      .update({
        staff_member_id: payload.staffMemberId,
        entry_date: payload.entryDate,
        entry_type: payload.entryType,
        worked_hours: payload.workedHours,
        notes: payload.notes.trim() || null,
      })
      .eq('id', payload.attendanceEntryId)
      .eq('user_id', userId);

    if (error) {
      this.handleSupabaseError('Errore durante l\'aggiornamento della presenza su Supabase.', error);
      const attendanceEntries = this.readLocalAttendance(userId).map((entry) =>
        entry.id === payload.attendanceEntryId
          ? {
              ...entry,
              staffMemberId: payload.staffMemberId,
              entryDate: payload.entryDate,
              entryType: payload.entryType,
              workedHours: payload.workedHours,
              notes: payload.notes.trim(),
            }
          : entry,
      );
      this.writeLocalAttendance(userId, attendanceEntries);
    }
  }

  async deleteAttendanceEntry(attendanceEntryId: string): Promise<void> {
    const userId = await this.getCurrentUserId();

    if (!this.supabase || !this.isRemoteAvailable) {
      const attendanceEntries = this.readLocalAttendance(userId).filter((entry) => entry.id !== attendanceEntryId);
      this.writeLocalAttendance(userId, attendanceEntries);
      return;
    }

    const { error } = await this.supabase
      .from('attendance_entries')
      .delete()
      .eq('id', attendanceEntryId)
      .eq('user_id', userId);

    if (error) {
      this.handleSupabaseError('Errore durante la cancellazione della presenza da Supabase.', error);
    }
  }

  private mapStaffMemberRow(row: StaffMemberRow): StaffMember {
    return {
      id: row.id,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active ?? true,
      defaultDailyHours: row.default_daily_hours ?? 0,
      weeklySchedule: this.normalizeWeeklySchedule(row.weekly_schedule, row.default_daily_hours ?? 0),
      createdAt: row.created_at,
    };
  }

  private mapDailySaleRow(row: DailySaleRow): DailySale {
    return {
      id: row.id,
      saleDate: row.sale_date,
      staffMemberId: row.staff_member_id,
      regularAmount: row.regular_amount,
      testAmount: row.test_amount,
      notes: row.notes ?? '',
      createdAt: row.created_at,
    };
  }

  private mapAttendanceEntryRow(row: AttendanceEntryRow): AttendanceEntry {
    return {
      id: row.id,
      staffMemberId: row.staff_member_id,
      entryDate: row.entry_date,
      entryType: row.entry_type,
      workedHours: row.worked_hours,
      notes: row.notes ?? '',
      createdAt: row.created_at,
    };
  }

  private readLocalStaff(userId: string): StaffMember[] {
    const rawValue = localStorage.getItem(this.getScopedStorageKey(this.staffStorageKey, userId));

    if (!rawValue) {
      return [];
    }

    try {
      return (JSON.parse(rawValue) as StaffMember[]).map((member) => ({
        ...member,
        isActive: member.isActive ?? true,
        defaultDailyHours: member.defaultDailyHours ?? 0,
        weeklySchedule: this.normalizeWeeklySchedule(member.weeklySchedule, member.defaultDailyHours ?? 0),
      }));
    } catch (error) {
      console.error('Errore durante la lettura del personale locale.', error);
      return [];
    }
  }

  private writeLocalStaff(userId: string, staffMembers: StaffMember[]): void {
    localStorage.setItem(this.getScopedStorageKey(this.staffStorageKey, userId), JSON.stringify(staffMembers));
  }

  private readLocalSales(userId: string): DailySale[] {
    const rawValue = localStorage.getItem(this.getScopedStorageKey(this.salesStorageKey, userId));

    if (!rawValue) {
      return [];
    }

    try {
      return JSON.parse(rawValue) as DailySale[];
    } catch (error) {
      console.error('Errore durante la lettura degli incassi locali.', error);
      return [];
    }
  }

  private writeLocalSales(userId: string, dailySales: DailySale[]): void {
    localStorage.setItem(this.getScopedStorageKey(this.salesStorageKey, userId), JSON.stringify(dailySales));
  }

  private readLocalAttendance(userId: string): AttendanceEntry[] {
    const rawValue = localStorage.getItem(this.getScopedStorageKey(this.attendanceStorageKey, userId));

    if (!rawValue) {
      return [];
    }

    try {
      return JSON.parse(rawValue) as AttendanceEntry[];
    } catch (error) {
      console.error('Errore durante la lettura delle presenze locali.', error);
      return [];
    }
  }

  private writeLocalAttendance(userId: string, attendanceEntries: AttendanceEntry[]): void {
    localStorage.setItem(
      this.getScopedStorageKey(this.attendanceStorageKey, userId),
      JSON.stringify(attendanceEntries),
    );
  }

  private readLocalSettings(): AppSettings {
    const rawValue = localStorage.getItem(this.settingsStorageKey);

    if (!rawValue) {
      return { companyClosureDays: ['domenica'] };
    }

    try {
      const parsedValue = JSON.parse(rawValue) as AppSettings;
      return {
        companyClosureDays: this.normalizeClosureDays(parsedValue.companyClosureDays),
      };
    } catch (error) {
      console.error('Errore durante la lettura delle impostazioni aziendali locali.', error);
      return { companyClosureDays: ['domenica'] };
    }
  }

  private writeLocalSettings(settings: AppSettings): void {
    localStorage.setItem(this.settingsStorageKey, JSON.stringify(settings));
  }

  private normalizeWeeklySchedule(
    weeklySchedule: WeeklyShiftTemplate | null | undefined,
    defaultDailyHours: number,
  ): WeeklyShiftTemplate {
    const fallbackSchedule = createWeeklyShiftTemplate(defaultDailyHours || 8);

    if (!weeklySchedule) {
      return fallbackSchedule;
    }

    return {
      lunedi: {
        isWorking: weeklySchedule.lunedi?.isWorking ?? fallbackSchedule.lunedi.isWorking,
        hours: weeklySchedule.lunedi?.hours ?? fallbackSchedule.lunedi.hours,
      },
      martedi: {
        isWorking: weeklySchedule.martedi?.isWorking ?? fallbackSchedule.martedi.isWorking,
        hours: weeklySchedule.martedi?.hours ?? fallbackSchedule.martedi.hours,
      },
      mercoledi: {
        isWorking: weeklySchedule.mercoledi?.isWorking ?? fallbackSchedule.mercoledi.isWorking,
        hours: weeklySchedule.mercoledi?.hours ?? fallbackSchedule.mercoledi.hours,
      },
      giovedi: {
        isWorking: weeklySchedule.giovedi?.isWorking ?? fallbackSchedule.giovedi.isWorking,
        hours: weeklySchedule.giovedi?.hours ?? fallbackSchedule.giovedi.hours,
      },
      venerdi: {
        isWorking: weeklySchedule.venerdi?.isWorking ?? fallbackSchedule.venerdi.isWorking,
        hours: weeklySchedule.venerdi?.hours ?? fallbackSchedule.venerdi.hours,
      },
      sabato: {
        isWorking: weeklySchedule.sabato?.isWorking ?? fallbackSchedule.sabato.isWorking,
        hours: weeklySchedule.sabato?.hours ?? fallbackSchedule.sabato.hours,
      },
      domenica: {
        isWorking: weeklySchedule.domenica?.isWorking ?? fallbackSchedule.domenica.isWorking,
        hours: weeklySchedule.domenica?.hours ?? fallbackSchedule.domenica.hours,
      },
    };
  }

  private normalizeClosureDays(closureDays: WeekdayKey[] | null | undefined): WeekdayKey[] {
    const validKeys: WeekdayKey[] = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'];
    const normalized = (closureDays ?? ['domenica']).filter((day): day is WeekdayKey => validKeys.includes(day));
    return normalized.length ? normalized : ['domenica'];
  }

  private handleSupabaseError(message: string, error: { code?: string } | null): void {
    this.isRemoteAvailable = false;
    this.unsubscribeFromDataChanges();

    if (error?.code === 'PGRST205' || error?.code === 'PGRST204') {
      console.warn(`${message} Passaggio automatico all'archivio locale.`, error);
      return;
    }

    console.error(message, error);
  }

  private unsubscribeFromDataChanges(channelToRemove?: RealtimeChannel): void {
    if (!this.supabase) {
      return;
    }

    const targetChannel = channelToRemove ?? this.dataChangesChannel;

    if (!targetChannel) {
      return;
    }

    void this.supabase.removeChannel(targetChannel);

    if (!channelToRemove || this.dataChangesChannel === channelToRemove) {
      this.dataChangesChannel = null;
    }
  }

  private async getCurrentUserId(): Promise<string> {
    if (this.currentUserId) {
      return this.currentUserId;
    }

    if (!this.supabase) {
      throw new Error('Configura Supabase per gestire i dati del profilo.');
    }

    const { data, error } = await this.supabase.auth.getUser();

    if (error || !data.user) {
      throw new Error('Sessione utente non disponibile.');
    }

    this.currentUserId = data.user.id;
    return data.user.id;
  }

  private getScopedStorageKey(baseKey: string, userId: string): string {
    return `${baseKey}-${userId}`;
  }

  private buildAuthError(message: string): Error {
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes('invalid login credentials')) {
      return new Error('Email o password non corretti.');
    }

    if (normalizedMessage.includes('email not confirmed')) {
      return new Error('Conferma prima l\'email dalla posta ricevuta.');
    }

    if (normalizedMessage.includes('user already registered')) {
      return new Error('Questa email e gia registrata.');
    }

    if (normalizedMessage.includes('password should be at least')) {
      return new Error('La password deve avere almeno 6 caratteri.');
    }

    return new Error(message);
  }
}
