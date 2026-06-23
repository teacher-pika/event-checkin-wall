// server.js - 報到系統伺服器
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Read config for mock users
let mockUserCount = 0;
try {
    const configPath = path.join(__dirname, 'config.js');
    if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const match = configContent.match(/useMockUserCount:\s*(\d+)/);
        if (match && match[1]) {
            mockUserCount = parseInt(match[1], 10);
        }
    }
} catch (error) {
    console.log('⚠️ Could not read config.js for mock user count, defaulting to 0.');
}

// 設定
const PORT = 3000;

// 資料儲存
let users = [];           // 所有參與者
let checkedInUsers = [];  // 已報到的參與者
let checkedInStatus = {}; // 報到狀態記錄 {id: true/false}

// 讀取 CSV 檔案
function loadUsersFromCSV() {
    users = [];
    const csvPath = path.join(__dirname, 'data.csv');
    
    // 檢查檔案是否存在
    if (!fs.existsSync(csvPath)) {
        console.log('⚠️ data.csv 不存在，使用預設資料');
        users = [
            { id: 'A001', name: '王小明', code: '1234', intro: '軟體工程師', quote: '程式改變世界', photo: '', checkedIn: false },
            { id: 'A002', name: '李美玲', code: '5678', intro: 'UI/UX設計師', quote: '設計就是生活', photo: '', checkedIn: false },
            { id: 'A003', name: '張志豪', code: '2468', intro: '專案經理', quote: '團隊合作是關鍵', photo: '', checkedIn: false }
        ];
        // 建立範例 CSV
        createSampleCSV();
        return;
    }
    
    // 讀取 CSV
    fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
            const photoId = row.id || row.ID || '';
            const possibleExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.JPG', '.JPEG', '.PNG'];

            // 1. 處理小照片路徑
            let photoPath = row.photo || row.照片 || row.Photo || '';
            if (photoPath && !photoPath.startsWith('http')) {
                photoPath = `/photo/${path.basename(photoPath)}`;
            } else if (!photoPath && photoId) {
                for (let ext of possibleExtensions) {
                    const testPath = path.join(__dirname, 'photo', photoId + ext);
                    if (fs.existsSync(testPath)) {
                        photoPath = `/photo/${photoId}${ext}`;
                        break;
                    }
                }
            }
            
            // 2. 處理大照片路徑
            let bigPhotoPath = '';
            if (photoId) {
                for (let ext of possibleExtensions) {
                    const testPath = path.join(__dirname, 'photo', `big${photoId}${ext}`);
                    if (fs.existsSync(testPath)) {
                        bigPhotoPath = `/photo/big${photoId}${ext}`;
                        break;
                    }
                }
            }
            
            // 3. 新增使用者資料，大照片路徑會備援使用小照片路徑
            const introText = row.intro || row.介紹 || row.Introduction || '';
            users.push({
                id: row.id || row.ID || '',
                name: row.name || row.姓名 || row.Name || '',
                code: row.code || row.代碼 || row.Code || '',
                intro: introText.replace(/\\n/g, '\n'), // 將 "\\n" 轉換為換行符
                quote: row.quote || row.金句 || row.Quote || '',
                photo: photoPath,
                bigPhoto: bigPhotoPath || photoPath, // 若無大照片，則使用小照片
                checkedIn: (row.checkedIn === 'true' || row.已報到 === '是' || row.checkedIn === '1')
            });
            
            // 記錄報到狀態
            checkedInStatus[row.id || row.ID] = (row.checkedIn === 'true' || row.已報到 === '是' || row.checkedIn === '1');
        })
        .on('end', () => {
            console.log(`✅ 載入 ${users.length} 位參與者資料`);
            
            // Generate mock users if configured (8011~8229)
            if (mockUserCount > 0 && users.length < mockUserCount) {
                const usersToCreate = mockUserCount - users.length;
                for (let i = 0; i < usersToCreate; i++) {
                    const mockNumber = 8011 + i; // Start from 8011
                    const mockId = String(mockNumber);
                    users.push({
                        id: mockId,
                        name: `測試員${String(mockNumber)}`,
                        code: String(mockNumber),
                        intro: '這是一個用於壓力測試的模擬使用者帳號。',
                        quote: '改變世界，從測試開始。',
                        photo: '', // 沒有小照片
                        bigPhoto: '', // 沒有大照片，前端會顯示文字替代
                        checkedIn: false
                    });
                }
                console.log(`✅ 已載入 ${usersToCreate} 位模擬使用者（8011~${8011 + usersToCreate - 1}），總人數達到 ${mockUserCount}。`);
            }

            console.log('參與者名單：', users.map(u => u.name).join(', '));
            
            // 載入已報到的使用者
            checkedInUsers = users.filter(u => u.checkedIn);
            console.log(`📊 已報到人數：${checkedInUsers.length}`);
        })
        .on('error', (error) => {
            console.error('❌ CSV 讀取錯誤:', error);
        });
}

// 建立範例 CSV
function createSampleCSV() {
    const csvContent = `id,name,code,intro,quote,photo,checkedIn
A001,王小明,1234,軟體工程師,程式改變世界,,false
A002,李美玲,5678,UI/UX設計師,設計就是生活,,false
A003,張志豪,2468,專案經理,團隊合作是關鍵,,false
A004,陳雅婷,1357,數據分析師,數據會說話,,false
A005,林俊傑,9999,後端架構師,優雅的程式碼,,false
A006,黃佳琪,3333,產品經理,用戶至上,,false
A007,劉建國,7777,DevOps工程師,自動化是關鍵,,false
A008,許雅雯,4444,行銷專員,創意無限,,false
A009,吳宗翰,6666,資安工程師,安全第一,,false
A010,趙詩涵,8888,QA工程師,品質保證,,false`;
    
    fs.writeFileSync('data.csv', csvContent, 'utf8');
    console.log('✅ 已建立範例 data.csv 檔案');
    
    // 建立 photo 資料夾
    const photoDir = path.join(__dirname, 'photo');
    if (!fs.existsSync(photoDir)) {
        fs.mkdirSync(photoDir);
        console.log('📁 已建立 photo 資料夾');
    }
}

// 更新 CSV 檔案（將報到狀態寫回）
function updateCSV() {
    const csvPath = path.join(__dirname, 'data.csv');
    
    // 準備 CSV 內容
    let csvContent = 'id,name,code,intro,quote,photo,checkedIn\n';
    
    users.forEach(user => {
        const isCheckedIn = checkedInUsers.some(u => u.id === user.id);
        const photoPath = user.photo ? user.photo.replace('/photo/', '') : '';
        csvContent += `${user.id},${user.name},${user.code},${user.intro},${user.quote},${photoPath},${isCheckedIn}\n`;
    });
    
    // 寫入檔案
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    console.log('💾 已更新 data.csv 報到狀態');
    
    // 同時輸出報到清單
    const reportPath = path.join(__dirname, `checkin_report_${new Date().toISOString().split('T')[0]}.csv`);
    let reportContent = 'ID,姓名,代碼,報到狀態,報到時間\n';
    
    users.forEach(user => {
        const checkedInUser = checkedInUsers.find(u => u.id === user.id);
        const status = checkedInUser ? '已報到' : '未報到';
        const time = checkedInUser && checkedInUser.checkedInAt ? 
                     new Date(checkedInUser.checkedInAt).toLocaleString('zh-TW') : '';
        reportContent += `${user.id},${user.name},${user.code},${status},${time}\n`;
    });
    
    fs.writeFileSync(reportPath, reportContent, 'utf8');
    console.log(`📋 已輸出報到報表：${reportPath}`);
}

// 載入已報到資料（從檔案恢復）
function loadCheckedInUsers() {
    const filePath = path.join(__dirname, 'checkedin.json');
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            checkedInUsers = JSON.parse(data);
            console.log(`✅ 恢復 ${checkedInUsers.length} 位已報到資料`);
        } catch (error) {
            console.error('❌ 載入已報到資料失敗:', error);
            checkedInUsers = [];
        }
    }
}

// 儲存已報到資料
function saveCheckedInUsers() {
    const filePath = path.join(__dirname, 'checkedin.json');
    fs.writeFileSync(filePath, JSON.stringify(checkedInUsers, null, 2));
}

// 設定 Express
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// 提供 photo 資料夾的靜態檔案服務
app.use('/photo', express.static(path.join(__dirname, 'photo')));

// Serve config file
app.get('/config.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'config.js'));
});

// Main endpoint for server status and links
app.get('/', (req, res) => {
    res.send(`
        <h1>報到系統伺服器運行中</h1>
        <p>報到端：<a href="/checkin.html">/checkin.html</a></p>
        <p>呈現端：<a href="/display.html">/display.html</a></p>
        <hr>
        <p>目前載入 ${users.length} 位參與者</p>
        <p>已報到 ${checkedInUsers.length} 位</p>
    `);
});

// API：取得系統狀態
app.get('/api/status', (req, res) => {
    res.json({
        totalUsers: users.length,
        checkedInCount: checkedInUsers.length,
        users: users.map(u => ({ id: u.id, name: u.name }))
    });
});

// API：取得所有已報到使用者
app.get('/api/checkedin', (req, res) => {
    res.json(checkedInUsers);
});

// API：重置報到資料
app.post('/api/reset', (req, res) => {
    checkedInUsers = [];
    saveCheckedInUsers();
    updateCSV();  // 更新 CSV
    io.emit('reset');
    res.json({ message: '已重置所有報到資料' });
});

// API：匯出報到報表
app.get('/api/export', (req, res) => {
    const reportPath = path.join(__dirname, `checkin_report_${new Date().toISOString().split('T')[0]}.csv`);
    updateCSV();
    res.download(reportPath);
});

// API：現場新增貴賓
app.post('/api/add-guest', (req, res) => {
    const { name, intro, quote } = req.body;

    if (!name || name.trim() === '') {
        return res.json({ success: false, message: '姓名不可為空' });
    }

    // 自動生成 5 系列編號 (5001, 5002, 5003...)
    const guestUsers = users.filter(u => u.id.startsWith('5'));
    let nextNumber = 5001;
    if (guestUsers.length > 0) {
        const maxNumber = Math.max(...guestUsers.map(u => parseInt(u.id) || 5000));
        nextNumber = maxNumber + 1;
    }
    const newId = String(nextNumber);

    // 代碼與 ID 相同
    const newCode = String(nextNumber);

    const newUser = {
        id: newId,
        name: name.trim(),
        code: newCode,
        intro: intro ? intro.trim() : '',
        quote: quote ? quote.trim() : '',
        photo: '',
        bigPhoto: '',
        checkedIn: false
    };

    // 加入到使用者清單
    users.push(newUser);

    // 更新 CSV 檔案
    updateCSV();

    console.log(`✅ 新增貴賓：${newUser.name} (${newUser.id})`);

    // 廣播新增事件給所有連線的客戶端
    io.emit('guest-added', newUser);

    res.json({
        success: true,
        message: '成功新增貴賓',
        user: newUser
    });
});

// Socket.io 連線處理
io.on('connection', (socket) => {
    console.log('👤 新連線:', socket.id);
    
    // 發送目前狀態給新連線的客戶端
    socket.emit('initial-state', {
        users: users,
        checkedInUsers: checkedInUsers
    });
    
    // 處理報到請求
    socket.on('checkin', (code) => {
        console.log('📝 收到報到請求，代碼:', code);
        
        // 尋找使用者
        const user = users.find(u => u.code === code);
        
        if (!user) {
            socket.emit('checkin-error', '無效的報到代碼');
            return;
        }
        
        // 檢查是否已報到
        if (checkedInUsers.find(u => u.id === user.id)) {
            socket.emit('checkin-error', '您已經報到過了');
            return;
        }
        
        // 加入報到時間
        const checkedInUser = {
            ...user,
            checkedInAt: new Date().toISOString()
        };
        
        // 新增到已報到名單
        checkedInUsers.push(checkedInUser);
        saveCheckedInUsers();
        
        // 更新 CSV 檔案
        updateCSV();
        
        // 通知所有連線的客戶端
        io.emit('user-checked-in', checkedInUser);
        
        // 回應報到成功
        socket.emit('checkin-success', checkedInUser);
        
        console.log(`✅ ${user.name} 報到成功！目前 ${checkedInUsers.length}/${users.length} 人`);
    });
    
    // 處理斷線
    socket.on('disconnect', () => {
        console.log('👤 斷線:', socket.id);
    });
});

// 啟動伺服器
function startServer() {
    loadUsersFromCSV();
    loadCheckedInUsers();
    
    http.listen(PORT, () => {
        console.log('=====================================');
        console.log(`🚀 報到系統伺服器啟動成功！`);
        console.log(`📍 伺服器位址: http://localhost:${PORT}`);
        console.log('');
        console.log('🖥️  請在不同電腦的瀏覽器開啟（將 <YOUR_SERVER_IP> 換成本機區域網路 IP）：');
        console.log(`   報到端: http://<YOUR_SERVER_IP>:${PORT}/checkin.html`);
        console.log(`   呈現端: http://<YOUR_SERVER_IP>:${PORT}/display.html`);
        console.log('');
        console.log('💡 提示：使用 ipconfig (Windows) 或 ifconfig (Mac/Linux) 查看伺服器 IP');
        console.log('=====================================');
    });
}

// 優雅關閉
process.on('SIGINT', () => {
    console.log('\n正在關閉伺服器...');
    saveCheckedInUsers();
    process.exit(0);
});

// 啟動
startServer();