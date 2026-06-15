import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertCircle, Users, Wrench, Calendar, ClipboardList, LogOut, 
  Plus, Edit2, Trash2, Lock, Unlock, CheckCircle, XCircle, 
  Search, Building2, UserCheck, Truck, RefreshCw, Key
} from 'lucide-react';
import { api } from '../../lib/api';
import { logout, getCurrentUser, type AuthenticatedUser } from '../../lib/auth';
import { SUBSYSTEMS } from '../auth/Login';

interface SystemRole {
  role: string;
  system: string;
}

interface UserRecord {
  id: string;
  name: string;
  username: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedAt: string | null;
  roles: SystemRole[];
}

export default function ModuleSelection() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [activeTab, setActiveTab] = useState<'subsystems' | 'users' | 'vehicles' | 'garages' | 'drivers'>('subsystems');
  
  // Shared Admin state
  const [isAdmin, setIsAdmin] = useState(false);

  // Users Tab state
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'reset-pw'>('create');
  
  // User Form State
  const [selectedUserId, setSelectedUserId] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [vrmsRole, setVrmsRole] = useState('');
  const [vmmsRole, setVmmsRole] = useState('');
  const [bmsRole, setBmsRole] = useState('');
  const [sharedRole, setSharedRole] = useState('');
  const [formError, setFormError] = useState('');

  // Vehicles, Garages, Drivers States
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [garages, setGarages] = useState<any[]>([]);
  const [garagesLoading, setGaragesLoading] = useState(false);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);

  // Vehicles CRUD state
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vehicleModalMode, setVehicleModalMode] = useState<'create' | 'edit'>('create');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleOdometer, setVehicleOdometer] = useState<number | string>(0);
  const [vehicleStatus, setVehicleStatus] = useState('AVAILABLE');
  const [vehicleIsActive, setVehicleIsActive] = useState(true);

  // Garages CRUD state
  const [showGarageModal, setShowGarageModal] = useState(false);
  const [garageModalMode, setGarageModalMode] = useState<'create' | 'edit'>('create');
  const [selectedGarageId, setSelectedGarageId] = useState('');
  const [garageName, setGarageName] = useState('');
  const [garageIsActive, setGarageIsActive] = useState(true);

  // Drivers CRUD state
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [driverModalMode, setDriverModalMode] = useState<'create' | 'edit'>('create');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverLicenseNumber, setDriverLicenseNumber] = useState('');
  const [driverIsVerified, setDriverIsVerified] = useState(false);
  const [driverIsActive, setDriverIsActive] = useState(true);

  // Dialog / Toast alerts
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    setCurrentUser(user);

    // Check if user is SHARED Admin
    const hasAdmin = (user.roles || []).some(
      (r) => r.system.toUpperCase() === 'SHARED' && r.role.toUpperCase() === 'ADMIN'
    );
    setIsAdmin(hasAdmin);
  }, [navigate]);

  // Load Admin Data on tab changes
  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'vehicles') {
      fetchVehicles();
    } else if (activeTab === 'garages') {
      fetchGarages();
    } else if (activeTab === 'drivers') {
      fetchDrivers();
    }
  }, [activeTab, isAdmin]);

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  // ─── USER OPERATIONS ───
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await api.get('/auth/users');
      setUsers(response.data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleCreateOrUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim() || !username.trim()) {
      setFormError('Name and Username are required.');
      return;
    }

    // Prepare role assignments
    const roleAssignments: any[] = [];
    if (vrmsRole) roleAssignments.push({ system: 'VRMS', role: vrmsRole });
    if (vmmsRole) roleAssignments.push({ system: 'VMMS', role: vmmsRole });
    if (bmsRole) roleAssignments.push({ system: 'BMS', role: bmsRole });
    if (sharedRole) roleAssignments.push({ system: 'SHARED', role: sharedRole });

    if (roleAssignments.length === 0) {
      setFormError('At least one role assignment is required.');
      return;
    }

    try {
      if (modalMode === 'create') {
        if (!password) {
          setFormError('Password is required for new users.');
          return;
        }
        await api.post('/auth/users', {
          name: name.trim(),
          username: username.trim(),
          password: password,
          roleAssignments,
        });
        showToast(`User ${username} created successfully!`);
      } else {
        await api.patch(`/auth/users/${selectedUserId}`, {
          name: name.trim(),
          username: username.trim(),
          password: password || undefined,
          roleAssignments,
        });
        showToast(`User ${username} updated successfully!`);
      }
      setShowUserModal(false);
      fetchUsers();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save user.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!password) {
      setFormError('Please enter a new password.');
      return;
    }

    try {
      await api.patch(`/auth/users/${selectedUserId}/password`, {
        password: password,
      });
      showToast(`Password reset successfully for ${username}!`);
      setShowUserModal(false);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to reset password.');
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await api.patch(`/auth/users/${userId}/status`, {
        isActive: !currentStatus,
      });
      showToast(`User status updated!`);
      fetchUsers();
    } catch (err) {
      console.error('Failed to toggle user status:', err);
    }
  };

  const handleUnlockUser = async (userId: string) => {
    try {
      await api.patch(`/auth/users/${userId}/unlock`);
      showToast(`User account unlocked!`);
      fetchUsers();
    } catch (err) {
      console.error('Failed to unlock user:', err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/auth/users/${userId}`);
      showToast(`User deleted successfully!`);
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  // Open modal helper
  const openModal = (mode: 'create' | 'edit' | 'reset-pw', user?: UserRecord) => {
    setModalMode(mode);
    setFormError('');
    if (mode === 'create') {
      setSelectedUserId('');
      setName('');
      setUsername('');
      setPassword('');
      setVrmsRole('');
      setVmmsRole('');
      setBmsRole('');
      setSharedRole('');
    } else {
      if (!user) return;
      setSelectedUserId(user.id);
      setName(user.name);
      setUsername(user.username);
      setPassword('');

      const getRole = (sys: string) => user.roles.find(r => r.system.toUpperCase() === sys)?.role || '';
      setVrmsRole(getRole('VRMS'));
      setVmmsRole(getRole('VMMS'));
      setBmsRole(getRole('BMS'));
      setSharedRole(getRole('SHARED'));
    }
    setShowUserModal(true);
  };

  // ─── VEHICLE OPERATIONS ───
  const fetchVehicles = async () => {
    setVehiclesLoading(true);
    try {
      const response = await api.get('/vehicles');
      setVehicles(response.data);
    } catch (err) {
      console.error('Failed to load vehicles:', err);
    } finally {
      setVehiclesLoading(false);
    }
  };

  const handleCreateOrUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!vehiclePlateNumber.trim() || !vehicleModel.trim()) {
      setFormError('Plate number and model are required.');
      return;
    }

    try {
      if (vehicleModalMode === 'create') {
        await api.post('/vehicles', {
          plateNumber: vehiclePlateNumber.trim(),
          model: vehicleModel.trim(),
          odometer: Number(vehicleOdometer) || 0,
          status: vehicleStatus,
        });
        showToast(`Vehicle ${vehiclePlateNumber} created successfully!`);
      } else {
        await api.patch(`/vehicles/${selectedVehicleId}`, {
          plateNumber: vehiclePlateNumber.trim(),
          model: vehicleModel.trim(),
          odometer: Number(vehicleOdometer) || 0,
          status: vehicleStatus,
          isActive: vehicleIsActive,
        });
        showToast(`Vehicle ${vehiclePlateNumber} updated successfully!`);
      }
      setShowVehicleModal(false);
      fetchVehicles();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save vehicle.');
    }
  };

  const handleDeleteVehicle = async (vehicleId: string, plateNumber: string) => {
    if (!confirm(`Are you sure you want to delete vehicle ${plateNumber}?`)) return;
    try {
      await api.delete(`/vehicles/${vehicleId}`);
      showToast(`Vehicle deleted successfully!`);
      fetchVehicles();
    } catch (err) {
      console.error('Failed to delete vehicle:', err);
    }
  };

  const openVehicleModal = (mode: 'create' | 'edit', vehicle?: any) => {
    setVehicleModalMode(mode);
    setFormError('');
    if (mode === 'create') {
      setSelectedVehicleId('');
      setVehiclePlateNumber('');
      setVehicleModel('');
      setVehicleOdometer(0);
      setVehicleStatus('AVAILABLE');
      setVehicleIsActive(true);
    } else {
      if (!vehicle) return;
      setSelectedVehicleId(vehicle.id);
      setVehiclePlateNumber(vehicle.plateNumber);
      setVehicleModel(vehicle.model);
      setVehicleOdometer(vehicle.odometer);
      setVehicleStatus(vehicle.status);
      setVehicleIsActive(vehicle.isActive);
    }
    setShowVehicleModal(true);
  };

  // ─── GARAGE OPERATIONS ───
  const fetchGarages = async () => {
    setGaragesLoading(true);
    try {
      const response = await api.get('/garages');
      setGarages(response.data);
    } catch (err) {
      console.error('Failed to load garages:', err);
    } finally {
      setGaragesLoading(false);
    }
  };

  const handleCreateOrUpdateGarage = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!garageName.trim()) {
      setFormError('Garage name is required.');
      return;
    }

    try {
      if (garageModalMode === 'create') {
        await api.post('/garages', {
          name: garageName.trim(),
        });
        showToast(`Garage ${garageName} created successfully!`);
      } else {
        await api.patch(`/garages/${selectedGarageId}`, {
          name: garageName.trim(),
          isActive: garageIsActive,
        });
        showToast(`Garage ${garageName} updated successfully!`);
      }
      setShowGarageModal(false);
      fetchGarages();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save garage.');
    }
  };

  const handleDeleteGarage = async (garageId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete garage ${name}?`)) return;
    try {
      await api.delete(`/garages/${garageId}`);
      showToast(`Garage deleted successfully!`);
      fetchGarages();
    } catch (err) {
      console.error('Failed to delete garage:', err);
    }
  };

  const openGarageModal = (mode: 'create' | 'edit', garage?: any) => {
    setGarageModalMode(mode);
    setFormError('');
    if (mode === 'create') {
      setSelectedGarageId('');
      setGarageName('');
      setGarageIsActive(true);
    } else {
      if (!garage) return;
      setSelectedGarageId(garage.id);
      setGarageName(garage.name);
      setGarageIsActive(garage.isActive);
    }
    setShowGarageModal(true);
  };

  // ─── DRIVER OPERATIONS ───
  const fetchDrivers = async () => {
    setDriversLoading(true);
    try {
      const response = await api.get('/drivers');
      setDrivers(response.data);
    } catch (err) {
      console.error('Failed to load drivers:', err);
    } finally {
      setDriversLoading(false);
    }
  };

  const handleCreateOrUpdateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!driverName.trim() || !driverLicenseNumber.trim()) {
      setFormError('Driver name and license number are required.');
      return;
    }

    try {
      if (driverModalMode === 'create') {
        await api.post('/drivers', {
          name: driverName.trim(),
          licenseNumber: driverLicenseNumber.trim(),
          isVerified: driverIsVerified,
        });
        showToast(`Driver ${driverName} created successfully!`);
      } else {
        await api.patch(`/drivers/${selectedDriverId}`, {
          name: driverName.trim(),
          licenseNumber: driverLicenseNumber.trim(),
          isVerified: driverIsVerified,
          isActive: driverIsActive,
        });
        showToast(`Driver ${driverName} updated successfully!`);
      }
      setShowDriverModal(false);
      fetchDrivers();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save driver.');
    }
  };

  const handleDeleteDriver = async (driverId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete driver ${name}?`)) return;
    try {
      await api.delete(`/drivers/${driverId}`);
      showToast(`Driver deleted successfully!`);
      fetchDrivers();
    } catch (err) {
      console.error('Failed to delete driver:', err);
    }
  };

  const openDriverModal = (mode: 'create' | 'edit', driver?: any) => {
    setDriverModalMode(mode);
    setFormError('');
    if (mode === 'create') {
      setSelectedDriverId('');
      setDriverName('');
      setDriverLicenseNumber('');
      setDriverIsVerified(false);
      setDriverIsActive(true);
    } else {
      if (!driver) return;
      setSelectedDriverId(driver.id);
      setDriverName(driver.name);
      setDriverLicenseNumber(driver.licenseNumber);
      setDriverIsVerified(driver.isVerified);
      setDriverIsActive(driver.isActive);
    }
    setShowDriverModal(true);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Helper check access
  const hasAccess = (sys: string) => {
    return (currentUser?.roles || []).some(
      (r) => r.system.toUpperCase() === sys.toUpperCase()
    );
  };

  const launchSubsystem = (sys: string) => {
    const config = SUBSYSTEMS[sys as keyof typeof SUBSYSTEMS];
    if (config) {
      const token = localStorage.getItem('token');
      window.location.href = `${config.url}/login?token=${token}`;
    }
  };

  return (
    <div className="min-h-screen flex bg-brand-darker text-slate-200">
      
      {/* ─── SIDEBAR ─── */}
      <aside className="w-64 bg-brand-dark border-r border-white/5 flex flex-col justify-between flex-shrink-0">
        <div>
          {/* Header Brand */}
          <div className="p-6 border-b border-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gold flex items-center justify-center">
              <img
                src="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100058644/296c4c4a-9502-46.jpg"
                alt="WeLinc"
                className="h-6 w-auto"
              />
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-tight leading-none">WeLinc</h1>
              <span className="text-[10px] text-white/40 tracking-wider uppercase font-semibold">Portal Hub</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('subsystems')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'subsystems' 
                  ? 'bg-brand-gold text-brand-blueAccent shadow-lg shadow-brand-gold/15' 
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <ClipboardList size={18} />
              Applications
            </button>

            {isAdmin && (
              <>
                <div className="pt-4 pb-2 px-4 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Shared Settings
                </div>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'users' 
                      ? 'bg-brand-gold text-brand-blueAccent shadow-lg shadow-brand-gold/15' 
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <Users size={18} />
                  User Accounts
                </button>
                <button
                  onClick={() => setActiveTab('vehicles')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'vehicles' 
                      ? 'bg-brand-gold text-brand-blueAccent shadow-lg shadow-brand-gold/15' 
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <Truck size={18} />
                  Fleet Vehicles
                </button>
                <button
                  onClick={() => setActiveTab('garages')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'garages' 
                      ? 'bg-brand-gold text-brand-blueAccent shadow-lg shadow-brand-gold/15' 
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <Building2 size={18} />
                  Garages
                </button>
                <button
                  onClick={() => setActiveTab('drivers')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'drivers' 
                      ? 'bg-brand-gold text-brand-blueAccent shadow-lg shadow-brand-gold/15' 
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <UserCheck size={18} />
                  Drivers
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Footer User Info */}
        <div className="p-4 border-t border-white/5 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold font-bold">
              {currentUser?.username?.slice(0,2).toUpperCase() || 'SA'}
            </div>
            <div>
              <h4 className="text-xs font-bold text-white truncate max-w-[130px]">{currentUser?.username}</h4>
              <span className="text-[10px] text-slate-500 font-semibold block capitalize">
                {isAdmin ? 'Super Administrator' : 'Staff'}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 text-sm font-bold transition-all cursor-pointer"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA ─── */}
      <main className="flex-1 p-8 lg:p-12 overflow-y-auto relative">
        {successMessage && (
          <div className="fixed top-6 right-6 z-50 bg-emerald-500 text-brand-darker px-5 py-3 rounded-xl shadow-2xl font-bold flex items-center gap-2 animate-bounce">
            <CheckCircle size={18} />
            {successMessage}
          </div>
        )}

        {/* ─── TAB: SUBSYSTEMS ─── */}
        {activeTab === 'subsystems' && (
          <div>
            <div className="mb-10">
              <h2 className="text-3xl font-black text-white mb-2">Operations Hub</h2>
              <p className="text-slate-400 text-sm">Select an operational dashboard system below.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* VRMS CARD */}
              <div 
                className={`border rounded-3xl p-6 transition-all relative overflow-hidden flex flex-col justify-between h-64 ${
                  hasAccess('VRMS') 
                    ? 'border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40 hover:-translate-y-1' 
                    : 'border-white/5 bg-white/[0.01] opacity-40 cursor-not-allowed'
                }`}
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
                    <Wrench size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Repairs & Maintenance (VRMS)</h3>
                  <p className="text-xs text-slate-400">Track vehicle repairs, costs, and audit logs.</p>
                </div>
                {hasAccess('VRMS') ? (
                  <button 
                    onClick={() => launchSubsystem('VRMS')}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-brand-darker font-black py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Open Repairs & Maintenance
                  </button>
                ) : (
                  <div className="text-xs text-red-400 font-semibold flex items-center gap-1.5">
                    <Lock size={12} /> Access Restricted
                  </div>
                )}
              </div>

              {/* VMMS CARD */}
              <div 
                className={`border rounded-3xl p-6 transition-all relative overflow-hidden flex flex-col justify-between h-64 ${
                  hasAccess('VMMS') 
                    ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 hover:-translate-y-1' 
                    : 'border-white/5 bg-white/[0.01] opacity-40 cursor-not-allowed'
                }`}
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                    <Calendar size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Monitoring & Schedules (VMMS)</h3>
                  <p className="text-xs text-slate-400">Manage inspection checklists and maintenance alerts.</p>
                </div>
                {hasAccess('VMMS') ? (
                  <button 
                    onClick={() => launchSubsystem('VMMS')}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-brand-darker font-black py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Open Fleet Monitoring
                  </button>
                ) : (
                  <div className="text-xs text-red-400 font-semibold flex items-center gap-1.5">
                    <Lock size={12} /> Access Restricted
                  </div>
                )}
              </div>

              {/* BMS CARD */}
              <div 
                className={`border rounded-3xl p-6 transition-all relative overflow-hidden flex flex-col justify-between h-64 ${
                  hasAccess('BMS') 
                    ? 'border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 hover:-translate-y-1' 
                    : 'border-white/5 bg-white/[0.01] opacity-40 cursor-not-allowed'
                }`}
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
                    <ClipboardList size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Booking & Operations (BMS)</h3>
                  <p className="text-xs text-slate-400">Plot client bookings, schedules, and trip logs.</p>
                </div>
                {hasAccess('BMS') ? (
                  <button 
                    onClick={() => launchSubsystem('BMS')}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-brand-darker font-black py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Open Booking & Operations
                  </button>
                ) : (
                  <div className="text-xs text-red-400 font-semibold flex items-center gap-1.5">
                    <Lock size={12} /> Access Restricted
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: USERS ─── */}
        {activeTab === 'users' && isAdmin && (
          <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-black text-white mb-2">User Account Management</h2>
                <p className="text-slate-400 text-sm">Add or edit system roles and active/lockout configurations.</p>
              </div>
              <button
                onClick={() => openModal('create')}
                className="bg-brand-gold hover:bg-brand-goldHover text-brand-blueAccent font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} />
                Create New User
              </button>
            </div>

            {/* List and Search */}
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6">
              <div className="relative mb-6">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search user by username or name..."
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/[0.04] border border-white/5 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 transition-all text-sm"
                />
              </div>

              {usersLoading ? (
                <div className="flex items-center justify-center p-12 text-slate-400 text-sm gap-2">
                  <RefreshCw className="animate-spin" size={16} /> Loading user records...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-slate-400 font-semibold">
                        <th className="pb-3 px-4">Full Name</th>
                        <th className="pb-3 px-4">Username</th>
                        <th className="pb-3 px-4">System Roles</th>
                        <th className="pb-3 px-4">Status</th>
                        <th className="pb-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users
                        .filter(u => 
                          u.name.toLowerCase().includes(usersSearch.toLowerCase()) ||
                          u.username.toLowerCase().includes(usersSearch.toLowerCase())
                        )
                        .map(user => (
                          <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.01]">
                            <td className="py-4 px-4 font-bold text-white">{user.name}</td>
                            <td className="py-4 px-4 text-slate-300 font-semibold">{user.username}</td>
                            <td className="py-4 px-4">
                              <div className="flex flex-wrap gap-1.5">
                                {user.roles.map((r, idx) => (
                                  <span key={idx} className="bg-white/5 border border-white/5 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">
                                    {r.system}: {r.role}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              {user.lockedAt ? (
                                <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-max">
                                  <Lock size={12} /> Locked
                                </span>
                              ) : user.isActive ? (
                                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-max">
                                  <CheckCircle size={12} /> Active
                                </span>
                              ) : (
                                <span className="bg-slate-500/10 border border-slate-500/20 text-slate-400 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-max">
                                  <XCircle size={12} /> Inactive
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex justify-end gap-2">
                                {user.lockedAt && (
                                  <button
                                    onClick={() => handleUnlockUser(user.id)}
                                    className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                                    title="Unlock account"
                                  >
                                    <Unlock size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() => toggleUserStatus(user.id, user.isActive)}
                                  className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                    user.isActive ? 'text-slate-400 hover:bg-slate-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'
                                  }`}
                                  title={user.isActive ? 'Deactivate user' : 'Activate user'}
                                >
                                  {user.isActive ? <XCircle size={16} /> : <CheckCircle size={16} />}
                                </button>
                                <button
                                  onClick={() => openModal('reset-pw', user)}
                                  className="p-2 text-brand-gold hover:bg-brand-gold/10 rounded-lg transition-colors cursor-pointer"
                                  title="Reset password"
                                >
                                  <Key size={16} />
                                </button>
                                <button
                                  onClick={() => openModal('edit', user)}
                                  className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Edit user details & roles"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Delete user"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: VEHICLES ─── */}
        {activeTab === 'vehicles' && isAdmin && (
          <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-black text-white mb-2">Fleet Vehicles</h2>
                <p className="text-slate-400 text-sm">Real-time status tracking and odometer records of trucks.</p>
              </div>
              <button
                onClick={() => openVehicleModal('create')}
                className="bg-brand-gold hover:bg-brand-goldHover text-brand-blueAccent font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} />
                Create New Vehicle
              </button>
            </div>
            
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6">
              {vehiclesLoading ? (
                <div className="flex justify-center p-12 text-sm text-slate-400">Loading vehicles...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-slate-400 font-semibold">
                        <th className="pb-3 px-4">Plate Number</th>
                        <th className="pb-3 px-4">Model</th>
                        <th className="pb-3 px-4">Odometer</th>
                        <th className="pb-3 px-4">Status</th>
                        <th className="pb-3 px-4">Active</th>
                        <th className="pb-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicles.map(v => (
                        <tr key={v.id} className="border-b border-white/5 hover:bg-white/[0.01]">
                          <td className="py-4 px-4 font-bold text-white">{v.plateNumber}</td>
                          <td className="py-4 px-4 text-slate-300 font-semibold">{v.model}</td>
                          <td className="py-4 px-4 text-slate-300 font-semibold">{Number(v.odometer).toLocaleString()} km</td>
                          <td className="py-4 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              v.status === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              v.status === 'UNDER_REPAIR' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                              'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {v.status}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            {v.isActive ? (
                              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-bold w-max block">Active</span>
                            ) : (
                              <span className="bg-slate-500/10 border border-slate-500/20 text-slate-400 px-2.5 py-0.5 rounded-full text-xs font-bold w-max block">Inactive</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openVehicleModal('edit', v)}
                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Edit vehicle"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteVehicle(v.id, v.plateNumber)}
                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Delete vehicle"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: GARAGES ─── */}
        {activeTab === 'garages' && isAdmin && (
          <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-black text-white mb-2">Service Garages</h2>
                <p className="text-slate-400 text-sm">Service shop and maintenance terminals configuration.</p>
              </div>
              <button
                onClick={() => openGarageModal('create')}
                className="bg-brand-gold hover:bg-brand-goldHover text-brand-blueAccent font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} />
                Create New Garage
              </button>
            </div>
            
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 max-w-3xl">
              {garagesLoading ? (
                <div className="flex justify-center p-12 text-sm text-slate-400">Loading garages...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-slate-400 font-semibold">
                        <th className="pb-3 px-4">Garage Name</th>
                        <th className="pb-3 px-4">Status</th>
                        <th className="pb-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {garages.map(g => (
                        <tr key={g.id} className="border-b border-white/5 hover:bg-white/[0.01]">
                          <td className="py-4 px-4 font-bold text-white">{g.name}</td>
                          <td className="py-4 px-4">
                            {g.isActive ? (
                              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-max">
                                <CheckCircle size={12} /> Active
                              </span>
                            ) : (
                              <span className="bg-slate-500/10 border border-slate-500/20 text-slate-400 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-max">
                                <XCircle size={12} /> Inactive
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openGarageModal('edit', g)}
                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Edit garage"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteGarage(g.id, g.name)}
                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Delete garage"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: DRIVERS ─── */}
        {activeTab === 'drivers' && isAdmin && (
          <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-black text-white mb-2">Drivers</h2>
                <p className="text-slate-400 text-sm">List of registered drivers and their credentials verification status.</p>
              </div>
              <button
                onClick={() => openDriverModal('create')}
                className="bg-brand-gold hover:bg-brand-goldHover text-brand-blueAccent font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={16} />
                Create New Driver
              </button>
            </div>
            
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 max-w-4xl">
              {driversLoading ? (
                <div className="flex justify-center p-12 text-sm text-slate-400">Loading drivers...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-slate-400 font-semibold">
                        <th className="pb-3 px-4">Driver Name</th>
                        <th className="pb-3 px-4">License Number</th>
                        <th className="pb-3 px-4">Verification</th>
                        <th className="pb-3 px-4">Status</th>
                        <th className="pb-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drivers.map(d => (
                        <tr key={d.id} className="border-b border-white/5 hover:bg-white/[0.01]">
                          <td className="py-4 px-4 font-bold text-white">{d.name}</td>
                          <td className="py-4 px-4 text-slate-300 font-semibold uppercase">{d.licenseNumber}</td>
                          <td className="py-4 px-4">
                            {d.isVerified ? (
                              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-max">
                                <CheckCircle size={12} /> Verified
                              </span>
                            ) : (
                              <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-max">
                                <XCircle size={12} /> Pending
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {d.isActive ? (
                              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-bold w-max block">Active</span>
                            ) : (
                              <span className="bg-slate-500/10 border border-slate-500/20 text-slate-400 px-2.5 py-0.5 rounded-full text-xs font-bold w-max block">Inactive</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openDriverModal('edit', d)}
                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Edit driver"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteDriver(d.id, d.name)}
                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Delete driver"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* ─── MODAL: USER CREATE/EDIT ─── */}
      {showUserModal && (
        <div className="fixed inset-0 bg-brand-darker/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-brand-dark border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {modalMode === 'create' ? 'Create New User Account' : modalMode === 'edit' ? 'Edit User Roles' : 'Reset Password'}
              </h3>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer text-xl font-bold">×</button>
            </div>

            <form onSubmit={modalMode === 'reset-pw' ? handleResetPassword : handleCreateOrUpdateUser} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {formError}
                </div>
              )}

              {modalMode !== 'reset-pw' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Display Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Maria Santos"
                      className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/5 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. msantos"
                      disabled={modalMode === 'edit'}
                      className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/5 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 text-sm disabled:opacity-50"
                    />
                  </div>
                </>
              )}

              {(modalMode === 'create' || modalMode === 'reset-pw') && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {modalMode === 'create' ? 'Password' : 'New Password'}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/5 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 text-sm"
                  />
                </div>
              )}

              {modalMode !== 'reset-pw' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">Application Role Mappings</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1.5">VRMS Role</label>
                      <select 
                        value={vrmsRole} 
                        onChange={(e) => setVrmsRole(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/5 rounded-xl text-slate-300 text-xs p-2.5 focus:outline-none"
                      >
                        <option value="">None (No Access)</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="MECHANIC">MECHANIC</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5">VMMS Role</label>
                      <select 
                        value={vmmsRole} 
                        onChange={(e) => setVmmsRole(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/5 rounded-xl text-slate-300 text-xs p-2.5 focus:outline-none"
                      >
                        <option value="">None (No Access)</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="OPERATIONS">OPERATIONS</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5">BMS Role</label>
                      <select 
                        value={bmsRole} 
                        onChange={(e) => setBmsRole(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/5 rounded-xl text-slate-300 text-xs p-2.5 focus:outline-none"
                      >
                        <option value="">None (No Access)</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="OPERATIONS">OPERATIONS</option>
                        <option value="CUSTOMER_SUPPORT">CUSTOMER_SUPPORT</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">SHARED Portal Role</label>
                      <select 
                        value={sharedRole} 
                        onChange={(e) => setSharedRole(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/5 rounded-xl text-slate-300 text-xs p-2.5 focus:outline-none"
                      >
                        <option value="">None</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-white/10 text-slate-300 hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-gold text-brand-blueAccent hover:bg-brand-goldHover cursor-pointer shadow-md"
                >
                  {modalMode === 'reset-pw' ? 'Reset Password' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: VEHICLE CREATE/EDIT ─── */}
      {showVehicleModal && (
        <div className="fixed inset-0 bg-brand-darker/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-brand-dark border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {vehicleModalMode === 'create' ? 'Create New Vehicle' : 'Edit Vehicle Details'}
              </h3>
              <button onClick={() => setShowVehicleModal(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer text-xl font-bold">×</button>
            </div>

            <form onSubmit={handleCreateOrUpdateVehicle} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Plate Number</label>
                <input
                  type="text"
                  value={vehiclePlateNumber}
                  onChange={(e) => setVehiclePlateNumber(e.target.value)}
                  placeholder="e.g. TUV-901"
                  required
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/5 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Model</label>
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="e.g. Isuzu Elf"
                  required
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/5 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Odometer (km)</label>
                <input
                  type="number"
                  value={vehicleOdometer}
                  onChange={(e) => setVehicleOdometer(e.target.value)}
                  placeholder="e.g. 45000"
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/5 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Vehicle Status</label>
                <select
                  value={vehicleStatus}
                  onChange={(e) => setVehicleStatus(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/5 rounded-xl text-slate-300 text-sm p-2.5 focus:outline-none"
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="UNDER_REPAIR">UNDER_REPAIR</option>
                  <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
                </select>
              </div>

              {vehicleModalMode === 'edit' && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="vehicleIsActive"
                    checked={vehicleIsActive}
                    onChange={(e) => setVehicleIsActive(e.target.checked)}
                    className="w-4 h-4 accent-brand-gold bg-white/[0.04] border border-white/5 rounded focus:ring-0"
                  />
                  <label htmlFor="vehicleIsActive" className="text-xs font-bold text-slate-300 select-none cursor-pointer">Active in Fleet</label>
                </div>
              )}

              <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-white/10 text-slate-300 hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-gold text-brand-blueAccent hover:bg-brand-goldHover cursor-pointer shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: GARAGE CREATE/EDIT ─── */}
      {showGarageModal && (
        <div className="fixed inset-0 bg-brand-darker/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-brand-dark border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {garageModalMode === 'create' ? 'Create New Garage' : 'Edit Garage Details'}
              </h3>
              <button onClick={() => setShowGarageModal(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer text-xl font-bold">×</button>
            </div>

            <form onSubmit={handleCreateOrUpdateGarage} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Garage Name</label>
                <input
                  type="text"
                  value={garageName}
                  onChange={(e) => setGarageName(e.target.value)}
                  placeholder="e.g. Marikina Garage"
                  required
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/5 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 text-sm"
                />
              </div>

              {garageModalMode === 'edit' && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="garageIsActive"
                    checked={garageIsActive}
                    onChange={(e) => setGarageIsActive(e.target.checked)}
                    className="w-4 h-4 accent-brand-gold bg-white/[0.04] border border-white/5 rounded focus:ring-0"
                  />
                  <label htmlFor="garageIsActive" className="text-xs font-bold text-slate-300 select-none cursor-pointer">Active Garage</label>
                </div>
              )}

              <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowGarageModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-white/10 text-slate-300 hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-gold text-brand-blueAccent hover:bg-brand-goldHover cursor-pointer shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: DRIVER CREATE/EDIT ─── */}
      {showDriverModal && (
        <div className="fixed inset-0 bg-brand-darker/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-brand-dark border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {driverModalMode === 'create' ? 'Create New Driver' : 'Edit Driver Details'}
              </h3>
              <button onClick={() => setShowDriverModal(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer text-xl font-bold">×</button>
            </div>

            <form onSubmit={handleCreateOrUpdateDriver} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Driver Name</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="e.g. Danilo Ramos"
                  required
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/5 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">License Number</label>
                <input
                  type="text"
                  value={driverLicenseNumber}
                  onChange={(e) => setDriverLicenseNumber(e.target.value)}
                  placeholder="e.g. N03-12-345678"
                  required
                  className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/5 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="driverIsVerified"
                  checked={driverIsVerified}
                  onChange={(e) => setDriverIsVerified(e.target.checked)}
                  className="w-4 h-4 accent-brand-gold bg-white/[0.04] border border-white/5 rounded focus:ring-0"
                />
                <label htmlFor="driverIsVerified" className="text-xs font-bold text-slate-300 select-none cursor-pointer">Credentials Verified</label>
              </div>

              {driverModalMode === 'edit' && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="driverIsActive"
                    checked={driverIsActive}
                    onChange={(e) => setDriverIsActive(e.target.checked)}
                    className="w-4 h-4 accent-brand-gold bg-white/[0.04] border border-white/5 rounded focus:ring-0"
                  />
                  <label htmlFor="driverIsActive" className="text-xs font-bold text-slate-300 select-none cursor-pointer">Active Driver</label>
                </div>
              )}

              <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDriverModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-white/10 text-slate-300 hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-gold text-brand-blueAccent hover:bg-brand-goldHover cursor-pointer shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
