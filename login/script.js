// Raven Panel - Game Account Management System
class RavenPanel {
    constructor() {
        this.state = {
            isLogin: true,
            showPassword: false,
            isLoggedIn: false,
            currentUser: null,
            users: [],
            selectedServer: 'all',
            selectedUser: null,
            loading: false,
            formData: {
                username: '',
                email: '',
                gameId: '',
                server: 'ASIA',
                level: 1,
                rank: 'Bronze',
                password: ''
            }
        };

        this.servers = [
            { id: 'ASIA', name: 'ASIA', color: '#ef4444' },
            { id: 'EU - MENA', name: 'EU - MENA', color: '#3b82f6' },
            { id: 'AMERICAS', name: 'AMERICAS', color: '#10b981' }
        ];

        this.ranks = [
            { id: 'Bronze', name: 'Bronze', color: '#cd7f32' },
            { id: 'Silver', name: 'Silver', color: '#c0c0c0' },
            { id: 'Gold', name: 'Gold', color: '#ffd700' },
            { id: 'Platinum', name: 'Platinum', color: '#e5e4e2' },
            { id: 'Diamond', name: 'Diamond', color: '#b9f2ff' },
            { id: 'Master', name: 'Master', color: '#9370db' },
            { id: 'Legend', name: 'Legend', color: '#ff4500' },
            { id: 'Mythic', name: 'Mythic', color: '#ff1493' }
        ];

        this.apiBaseUrl = 'https://ravenshoppanel.bloodstrike.workers.dev/'; // Change this to your worker URL
        
        this.init();
    }

    init() {
        this.loadFromLocalStorage();
        this.render();
        this.setupEventListeners();
    }

    loadFromLocalStorage() {
        const storedUsers = localStorage.getItem('gameUsers');
        if (storedUsers) {
            this.state.users = JSON.parse(storedUsers);
        } else {
            // Initial mock data
            const initialUsers = [
                {
                    id: 1,
                    username: 'SkyStriker',
                    email: 'sky@example.com',
                    gameId: 'SKY001',
                    server: 'ASIA',
                    level: 47,
                    rank: 'Diamond',
                    joinDate: '2023-01-15',
                    lastActive: '2024-01-20',
                    status: 'online'
                },
                {
                    id: 2,
                    username: 'ShadowRaven',
                    email: 'shadow@example.com',
                    gameId: 'SHD002',
                    server: 'EU - MENA',
                    level: 41,
                    rank: 'Master',
                    joinDate: '2023-02-20',
                    lastActive: '2024-01-19',
                    status: 'offline'
                },
                {
                    id: 3,
                    username: 'GreenBlade',
                    email: 'green@example.com',
                    gameId: 'GRN003',
                    server: 'AMERICAS',
                    level: 44,
                    rank: 'Platinum',
                    joinDate: '2023-03-10',
                    lastActive: '2024-01-18',
                    status: 'online'
                }
            ];
            this.state.users = initialUsers;
            localStorage.setItem('gameUsers', JSON.stringify(initialUsers));
        }
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action]')) {
                e.preventDefault();
                this.handleAction(e.target.dataset.action, e);
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.matches('[data-input]')) {
                this.handleInput(e.target.dataset.input, e.target.value, e.target);
            }
        });

        document.addEventListener('submit', (e) => {
            if (e.target.matches('#auth-form')) {
                e.preventDefault();
                this.handleSubmit();
            }
        });
    }

    handleAction(action, event) {
        switch (action) {
            case 'toggle-auth':
                this.state.isLogin = !this.state.isLogin;
                this.render();
                break;
            case 'toggle-password':
                this.state.showPassword = !this.state.showPassword;
                this.render();
                break;
            case 'logout':
                this.state.isLoggedIn = false;
                this.state.currentUser = null;
                this.render();
                break;
            case 'select-server':
                this.state.selectedServer = event.target.dataset.server;
                this.fetchUsers();
                break;
            case 'view-user':
                const userId = parseInt(event.target.dataset.userId);
                this.viewUser(userId);
                break;
            case 'back-to-users':
                this.state.selectedUser = null;
                this.render();
                break;
        }
    }

    handleInput(input, value, element) {
        if (input === 'level') {
            const numValue = parseInt(value);
            if (numValue >= 1 && numValue <= 50) {
                this.state.formData[input] = numValue;
            }
        } else {
            this.state.formData[input] = value;
        }
    }

    async handleSubmit() {
        this.state.loading = true;
        this.render();

        try {
            const endpoint = this.state.isLogin ? '/api/login' : '/api/register';
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.state.formData)
            });
            
            const data = await response.json();
            if (data.success) {
                if (!this.state.isLogin) {
                    this.addUserToLocalStorage();
                }
                
                this.state.currentUser = data.user || {
                    id: Date.now(),
                    username: this.state.formData.username,
                    email: this.state.formData.email,
                    gameId: this.state.formData.gameId,
                    server: this.state.formData.server,
                    level: this.state.formData.level,
                    rank: this.state.formData.rank
                };
                this.state.isLoggedIn = true;
            } else {
                alert(data.message || 'Operation failed');
            }
        } catch (error) {
            console.error('Error:', error);
            // Fallback for demo
            if (!this.state.isLogin) {
                this.addUserToLocalStorage();
            }
            
            this.state.currentUser = {
                id: Date.now(),
                username: this.state.formData.username,
                email: this.state.formData.email,
                gameId: this.state.formData.gameId,
                server: this.state.formData.server,
                level: this.state.formData.level,
                rank: this.state.formData.rank
            };
            this.state.isLoggedIn = true;
        } finally {
            this.state.loading = false;
            this.render();
        }
    }

    addUserToLocalStorage() {
        const newUser = {
            id: Date.now(),
            username: this.state.formData.username,
            email: this.state.formData.email,
            gameId: this.state.formData.gameId,
            server: this.state.formData.server,
            level: this.state.formData.level,
            rank: this.state.formData.rank,
            joinDate: new Date().toISOString().split('T')[0],
            lastActive: new Date().toISOString().split('T')[0],
            status: 'online'
        };
        
        const storedUsers = localStorage.getItem('gameUsers');
        let allUsers = storedUsers ? JSON.parse(storedUsers) : [];
        allUsers.push(newUser);
        localStorage.setItem('gameUsers', JSON.stringify(allUsers));
        this.state.users = allUsers;
    }

    async fetchUsers() {
        this.state.loading = true;
        this.render();

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/users${this.state.selectedServer !== 'all' ? `?server=${this.state.selectedServer}` : ''}`);
            const data = await response.json();
            if (data.success) {
                this.state.users = data.users;
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            // Use localStorage data as fallback
            const storedUsers = localStorage.getItem('gameUsers');
            if (storedUsers) {
                const allUsers = JSON.parse(storedUsers);
                if (this.state.selectedServer !== 'all') {
                    this.state.users = allUsers.filter(u => u.server === this.state.selectedServer);
                } else {
                    this.state.users = allUsers;
                }
            }
        } finally {
            this.state.loading = false;
            this.render();
        }
    }

    viewUser(userId) {
        const user = this.state.users.find(u => u.id === userId);
        if (user) {
            this.state.selectedUser = user;
            this.updateUserLastActive(userId);
            this.render();
        }
    }

    updateUserLastActive(userId) {
        const storedUsers = localStorage.getItem('gameUsers');
        if (storedUsers) {
            let allUsers = JSON.parse(storedUsers);
            const userIndex = allUsers.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                allUsers[userIndex].lastActive = new Date().toISOString().split('T')[0];
                allUsers[userIndex].status = 'online';
                localStorage.setItem('gameUsers', JSON.stringify(allUsers));
                this.state.users = allUsers;
            }
        }
    }

    render() {
        const app = document.getElementById('app');
        
        if (this.state.selectedUser) {
            app.innerHTML = this.renderUserProfile();
        } else if (this.state.isLoggedIn) {
            app.innerHTML = this.renderDashboard();
        } else {
            app.innerHTML = this.renderAuth();
        }

        // Re-initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    renderAuth() {
        return `
            <div class="min-h-screen flex items-center justify-center p-4 fade-in">
                <div class="w-full max-w-md">
                    <div class="text-center mb-8">
                        <div class="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center gradient-bg">
                            <i data-lucide="gamepad-2" class="w-9 h-9 text-white"></i>
                        </div>
                        <h1 class="text-3xl font-bold mb-2 text-white">Raven Panel</h1>
                        <p class="text-gray-400">مدیریت حساب‌های بازی</p>
                    </div>

                    <div class="glass-effect p-8">
                        <div class="flex mb-6 bg-gray-800 rounded-lg p-1">
                            <button 
                                data-action="toggle-auth"
                                class="flex-1 py-2 px-4 rounded-md font-medium transition-all cursor-pointer ${
                                    this.state.isLogin ? 'shadow-lg' : ''
                                }"
                                style="background-color: ${this.state.isLogin ? 'var(--primary)' : 'transparent'}; color: ${this.state.isLogin ? 'white' : 'var(--text-muted)'}"
                            >
                                ورود
                            </button>
                            <button 
                                data-action="toggle-auth"
                                class="flex-1 py-2 px-4 rounded-md font-medium transition-all cursor-pointer ${
                                    !this.state.isLogin ? 'shadow-lg' : ''
                                }"
                                style="background-color: ${!this.state.isLogin ? 'var(--primary)' : 'transparent'}; color: ${!this.state.isLogin ? 'white' : 'var(--text-muted)'}"
                            >
                                ثبت‌نام
                            </button>
                        </div>

                        <form id="auth-form" class="space-y-4">
                            ${this.state.isLogin ? this.renderLoginFields() : this.renderRegisterFields()}
                            
                            <div>
                                <label class="block text-sm font-medium mb-2 text-gray-300">رمز عبور</label>
                                <div class="relative">
                                    <div class="absolute right-3 top-3 text-gray-400">
                                        <i data-lucide="lock" class="w-4 h-4"></i>
                                    </div>
                                    <input
                                        type="${this.state.showPassword ? 'text' : 'password'}"
                                        name="password"
                                        data-input="password"
                                        value="${this.state.formData.password}"
                                        class="input-field pr-10"
                                        placeholder="رمز عبور خود را وارد کنید"
                                        required
                                    />
                                    <button 
                                        type="button"
                                        data-action="toggle-password"
                                        class="absolute left-3 top-3 text-gray-400"
                                    >
                                        <i data-lucide="${this.state.showPassword ? 'eye-off' : 'eye'}" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled="${this.state.loading}"
                                class="btn-primary w-full flex items-center justify-center gap-2 cursor-pointer"
                            >
                                ${this.state.loading ? '<div class="loading-spinner"></div>' : ''}
                                ${this.state.isLogin ? 'ورود' : 'ثبت‌نام'}
                                <i data-lucide="arrow-left" class="w-4 h-4 rotate-180"></i>
                            </button>
                        </form>

                        <div class="mt-6 text-center">
                            <p class="text-gray-400">
                                ${this.state.isLogin ? 'حساب کاربری ندارید؟' : 'قبلاً ثبت‌نام کرده‌اید؟'}
                                <button
                                    data-action="toggle-auth"
                                    class="font-medium mr-2 cursor-pointer"
                                    style="color: var(--primary)"
                                >
                                    ${this.state.isLogin ? 'ایجاد کنید' : 'وارد شوید'}
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderLoginFields() {
        return `
            <div>
                <label class="block text-sm font-medium mb-2 text-gray-300">ایمیل یا نام کاربری</label>
                <div class="relative">
                    <div class="absolute right-3 top-3 text-gray-400">
                        <i data-lucide="user" class="w-4 h-4"></i>
                    </div>
                    <input
                        type="text"
                        name="username"
                        data-input="username"
                        value="${this.state.formData.username}"
                        class="input-field pr-10"
                        placeholder="ایمیل یا نام کاربری خود را وارد کنید"
                        required
                    />
                </div>
            </div>
        `;
    }

    renderRegisterFields() {
        return `
            <div>
                <label class="block text-sm font-medium mb-2 text-gray-300">نام کاربری</label>
                <div class="relative">
                    <div class="absolute right-3 top-3 text-gray-400">
                        <i data-lucide="user" class="w-4 h-4"></i>
                    </div>
                    <input
                        type="text"
                        name="username"
                        data-input="username"
                        value="${this.state.formData.username}"
                        class="input-field pr-10"
                        placeholder="نام کاربری خود را وارد کنید"
                        required
                    />
                </div>
            </div>

            <div>
                <label class="block text-sm font-medium mb-2 text-gray-300">ایمیل</label>
                <div class="relative">
                    <div class="absolute right-3 top-3 text-gray-400">
                        <i data-lucide="mail" class="w-4 h-4"></i>
                    </div>
                    <input
                        type="email"
                        name="email"
                        data-input="email"
                        value="${this.state.formData.email}"
                        class="input-field pr-10"
                        placeholder="ایمیل خود را وارد کنید"
                        required
                    />
                </div>
            </div>

            <div>
                <label class="block text-sm font-medium mb-2 text-gray-300">شناسه بازی</label>
                <div class="relative">
                    <div class="absolute right-3 top-3 text-gray-400">
                        <i data-lucide="gamepad-2" class="w-4 h-4"></i>
                    </div>
                    <input
                        type="text"
                        name="gameId"
                        data-input="gameId"
                        value="${this.state.formData.gameId}"
                        class="input-field pr-10"
                        placeholder="شناسه بازی خود را وارد کنید"
                        required
                    />
                </div>
            </div>

            <div>
                <label class="block text-sm font-medium mb-2 text-gray-300">سرور</label>
                <div class="relative">
                    <div class="absolute right-3 top-3 text-gray-400">
                        <i data-lucide="globe" class="w-4 h-4"></i>
                    </div>
                    <select
                        name="server"
                        data-input="server"
                        class="input-field pr-10 appearance-none"
                    >
                        <option value="ASIA" ${this.state.formData.server === 'ASIA' ? 'selected' : ''}>ASIA</option>
                        <option value="EU - MENA" ${this.state.formData.server === 'EU - MENA' ? 'selected' : ''}>EU - MENA</option>
                        <option value="AMERICAS" ${this.state.formData.server === 'AMERICAS' ? 'selected' : ''}>AMERICAS</option>
                    </select>
                </div>
            </div>

            <div>
                <label class="block text-sm font-medium mb-2 text-gray-300">سطح شما (1-50)</label>
                <div class="relative">
                    <div class="absolute right-3 top-3 text-gray-400">
                        <i data-lucide="star" class="w-4 h-4"></i>
                    </div>
                    <input
                        type="number"
                        name="level"
                        data-input="level"
                        value="${this.state.formData.level}"
                        min="1"
                        max="50"
                        class="input-field pr-10"
                        placeholder="سطح خود را وارد کنید (1-50)"
                        required
                    />
                </div>
            </div>

            <div>
                <label class="block text-sm font-medium mb-2 text-gray-300">رنک شما</label>
                <div class="relative">
                    <div class="absolute right-3 top-3 text-gray-400">
                        <i data-lucide="shield" class="w-4 h-4"></i>
                    </div>
                    <select
                        name="rank"
                        data-input="rank"
                        class="input-field pr-10 appearance-none"
                    >
                        ${this.ranks.map(rank => `
                            <option value="${rank.id}" ${this.state.formData.rank === rank.id ? 'selected' : ''}>${rank.name}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;
    }

    renderDashboard() {
        const filteredUsers = this.state.selectedServer === 'all' 
            ? this.state.users 
            : this.state.users.filter(u => u.server === this.state.selectedServer);

        return `
            <div class="min-h-screen p-4 fade-in">
                <div class="max-w-7xl mx-auto">
                    <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                        <h1 class="text-3xl font-bold flex items-center gap-3 text-white">
                            <i data-lucide="users" class="w-8 h-8" style="color: var(--primary)"></i>
                            Raven Panel
                        </h1>
                        
                        <div class="flex items-center gap-4">
                            <div class="flex items-center gap-2 px-4 py-2 rounded-lg" style="background-color: var(--surface)">
                                <i data-lucide="zap" class="w-4 h-4" style="color: var(--primary)"></i>
                                <span class="text-white">${this.state.currentUser?.username}</span>
                            </div>
                            
                            <button
                                data-action="logout"
                                class="btn-primary cursor-pointer"
                            >
                                خروج
                            </button>
                        </div>
                    </div>

                    <div class="flex flex-col md:flex-row gap-4 mb-8">
                        <div class="flex items-center gap-2 p-4 rounded-xl" style="background-color: var(--surface)">
                            <i data-lucide="filter" class="w-5 h-5" style="color: var(--primary)"></i>
                            <span class="text-white">فیلتر سرور:</span>
                        </div>
                        
                        <button
                            data-action="select-server"
                            data-server="all"
                            class="px-6 py-2 rounded-lg font-medium transition-all cursor-pointer ${
                                this.state.selectedServer === 'all' ? 'ring-2 ring-offset-2 ring-offset-slate-900' : ''
                            }"
                            style="background-color: ${this.state.selectedServer === 'all' ? 'var(--primary)' : 'var(--surface)'}; color: ${this.state.selectedServer === 'all' ? 'white' : 'var(--text)'}"
                        >
                            همه (${this.state.users.length})
                        </button>
                        
                        ${this.servers.map(server => `
                            <button
                                data-action="select-server"
                                data-server="${server.id}"
                                class="px-6 py-2 rounded-lg font-medium transition-all cursor-pointer ${
                                    this.state.selectedServer === server.id ? 'ring-2 ring-offset-2 ring-offset-slate-900' : ''
                                }"
                                style="background-color: ${this.state.selectedServer === server.id ? 'var(--primary)' : 'var(--surface)'}; color: ${this.state.selectedServer === server.id ? 'white' : 'var(--text)'}"
                            >
                                ${server.name} (${this.state.users.filter(u => u.server === server.id).length})
                            </button>
                        `).join('')}
                    </div>

                    ${this.state.loading ? `
                        <div class="flex justify-center items-center h-64">
                            <div class="loading-spinner" style="width: 3rem; height: 3rem; border-color: var(--primary)"></div>
                        </div>
                    ` : `
                        <div class="user-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            ${filteredUsers.map(user => this.renderUserCard(user)).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    renderUserCard(user) {
        const serverClass = `server-${user.server.toLowerCase().replace(' - ', '-')}`;
        const isCurrentUser = this.state.currentUser?.id === user.id;
        
        return `
            <div class="user-card glass-effect p-6" data-action="view-user" data-user-id="${user.id}">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-full flex items-center justify-center gradient-bg">
                            <i data-lucide="gamepad-2" class="w-5 h-5 text-white"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-lg text-white">${user.username}</h3>
                            ${isCurrentUser ? `<p class="text-sm text-gray-400">${user.email}</p>` : `<p class="text-sm text-gray-400 flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i>${user.lastActive}</p>`}
                        </div>
                    </div>
                    <div class="${user.status === 'online' ? 'status-online' : 'status-offline'}"></div>
                </div>
                
                <div class="flex items-center justify-between mb-4">
                    <span class="server-badge ${serverClass}">${user.server}</span>
                    <div class="flex items-center gap-2">
                        <i data-lucide="star" class="w-4 h-4" style="color: var(--primary)"></i>
                        <span class="text-white">Lv.${user.level}</span>
                    </div>
                </div>
                
                <div class="flex items-center justify-between">
                    <span class="font-medium rank-${user.rank.toLowerCase()}">${user.rank}</span>
                    <button
                        data-action="view-user"
                        data-user-id="${user.id}"
                        class="btn-primary text-sm px-4 py-2 cursor-pointer"
                    >
                        مشاهده
                    </button>
                </div>
            </div>
        `;
    }

    renderUserProfile() {
        const user = this.state.selectedUser;
        const isCurrentUser = this.state.currentUser?.id === user.id;
        const serverClass = `server-${user.server.toLowerCase().replace(' - ', '-')}`;
        
        return `
            <div class="min-h-screen flex items-center justify-center p-4 fade-in">
                <div class="w-full max-w-2xl">
                    <div class="glass-effect p-8">
                        <button
                            data-action="back-to-users"
                            class="flex items-center gap-2 mb-6 px-4 py-2 rounded-lg transition-all hover:bg-opacity-80 cursor-pointer"
                            style="background-color: var(--surface-hover)"
                        >
                            <i data-lucide="arrow-left" class="w-5 h-5 text-white"></i>
                            <span class="text-white">بازگشت</span>
                        </button>
                        
                        <div class="text-center mb-8">
                            <div class="w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center gradient-bg">
                                <i data-lucide="gamepad-2" class="w-10 h-10 text-white"></i>
                            </div>
                            <h2 class="text-3xl font-bold mb-2 text-white">${user.username}</h2>
                            <div class="flex items-center justify-center gap-2">
                                <span class="server-badge ${serverClass}">${user.server}</span>
                                <div class="${user.status === 'online' ? 'status-online' : 'status-offline'}"></div>
                            </div>
                        </div>

                        <div class="profile-grid grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="p-4 rounded-xl" style="background-color: var(--background)">
                                <div class="flex items-center gap-3 mb-2">
                                    <i data-lucide="user" class="w-4 h-4" style="color: var(--primary)"></i>
                                    <span class="text-gray-400">نام کاربری</span>
                                </div>
                                <p class="font-semibold text-white">${user.username}</p>
                            </div>

                            ${isCurrentUser ? `
                                <div class="p-4 rounded-xl" style="background-color: var(--background)">
                                    <div class="flex items-center gap-3 mb-2">
                                        <i data-lucide="mail" class="w-4 h-4" style="color: var(--primary)"></i>
                                        <span class="text-gray-400">ایمیل</span>
                                    </div>
                                    <p class="font-semibold text-white">${user.email}</p>
                                </div>
                            ` : ''}

                            <div class="p-4 rounded-xl" style="background-color: var(--background)">
                                <div class="flex items-center gap-3 mb-2">
                                    <i data-lucide="gamepad-2" class="w-4 h-4" style="color: var(--primary)"></i>
                                    <span class="text-gray-400">شناسه بازی</span>
                                </div>
                                <p class="font-semibold text-white">${user.gameId}</p>
                            </div>

                            <div class="p-4 rounded-xl" style="background-color: var(--background)">
                                <div class="flex items-center gap-3 mb-2">
                                    <i data-lucide="globe" class="w-4 h-4" style="color: var(--primary)"></i>
                                    <span class="text-gray-400">سرور</span>
                                </div>
                                <p class="font-semibold text-white">${user.server}</p>
                            </div>

                            <div class="p-4 rounded-xl" style="background-color: var(--background)">
                                <div class="flex items-center gap-3 mb-2">
                                    <i data-lucide="star" class="w-4 h-4" style="color: var(--primary)"></i>
                                    <span class="text-gray-400">سطح</span>
                                </div>
                                <p class="font-semibold text-white">${user.level}</p>
                            </div>

                            <div class="p-4 rounded-xl" style="background-color: var(--background)">
                                <div class="flex items-center gap-3 mb-2">
                                    <i data-lucide="shield" class="w-4 h-4" style="color: var(--primary)"></i>
                                    <span class="text-gray-400">رنک</span>
                                </div>
                                <p class="font-semibold rank-${user.rank.toLowerCase()}">${user.rank}</p>
                            </div>

                            <div class="p-4 rounded-xl" style="background-color: var(--background)">
                                <div class="flex items-center gap-3 mb-2">
                                    <i data-lucide="clock" class="w-4 h-4" style="color: var(--primary)"></i>
                                    <span class="text-gray-400">آخرین فعالیت</span>
                                </div>
                                <p class="font-semibold text-white">${user.lastActive}</p>
                            </div>

                            <div class="p-4 rounded-xl" style="background-color: var(--background)">
                                <div class="flex items-center gap-3 mb-2">
                                    <i data-lucide="users" class="w-4 h-4" style="color: var(--primary)"></i>
                                    <span class="text-gray-400">وضعیت</span>
                                </div>
                                <p class="font-semibold text-white">
                                    ${user.status === 'online' ? 'آنلاین' : 'آفلاین'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new RavenPanel();
});