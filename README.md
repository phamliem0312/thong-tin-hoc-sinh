# Sổ học phí & nhật ký học tập

Ứng dụng web chạy hoàn toàn trên máy cá nhân (không cần internet, không cần cài
database) để gia sư quản lý học phí và nhật ký buổi học cho nhiều học sinh, in/
xuất PDF gửi phụ huynh.

- Giao diện: [index.html](index.html) — 1 file HTML tự chứa (React + Babel nhúng
  sẵn, không cần build).
- Backend: [server.js](server.js) — server Node thuần (không cài thêm thư viện
  nào), vừa phục vụ trang, vừa đọc/ghi dữ liệu.
- Dữ liệu: `storage/students.json` — toàn bộ danh sách học sinh lưu chung 1 file
  JSON trên đĩa.

## Yêu cầu

- [Node.js](https://nodejs.org) đã cài trên máy (kiểm tra bằng `node -v` trong
  PowerShell/CMD). Không cần cài thêm gói/thư viện nào khác.

## Triển khai lên một máy local khác

Toàn bộ ứng dụng là các file tĩnh + 1 server Node thuần, không có bước build,
nên "deploy" chỉ đơn giản là copy thư mục sang máy đích.

### 1. Copy thư mục dự án

Copy nguyên thư mục dự án sang máy đích, đặt ở bất kỳ ổ đĩa/thư mục nào cũng
được (các script tự nhận diện đường dẫn của chính nó, không cần sửa gì).

Bắt buộc phải có:

```
index.html
server.js
start-server.bat
open-app.vbs
```

Tùy chọn mang theo:

- `storage/students.json` — mang theo nếu muốn **giữ nguyên dữ liệu học sinh
  hiện có** sang máy mới. Không mang theo thì máy mới sẽ tự tạo danh sách
  trống khi chạy lần đầu.
- `test/` và `README.md` — không bắt buộc để chạy app, nhưng nên mang theo nếu
  máy đích cũng cần sửa code/chạy test sau này.
- `storage/server.log` — chỉ là log, không cần mang theo.

### 2. Cài Node.js trên máy đích (nếu chưa có)

Tải và cài từ [nodejs.org](https://nodejs.org) (bản LTS). Kiểm tra lại bằng
`node -v` trong PowerShell.

### 3. Chạy thử lần đầu

```powershell
cd <đường-dẫn-thư-mục-đã-copy>
node server.js
```

Mở trình duyệt tới **http://localhost:8080**, xác nhận trang lên đúng. Server
tự tạo thư mục `storage/` và file `storage/students.json` (`[]`) nếu chưa có
sẵn. Dừng bằng `Ctrl+C`.

### 4. Tạo shortcut khởi động nhanh trên Desktop (tùy chọn nhưng nên làm)

Chạy đoạn PowerShell sau **trên máy đích**, sau khi đã `cd` vào đúng thư mục dự
án (đường dẫn được lấy tự động từ thư mục hiện tại, không cần gõ tay):

```powershell
$appDir = (Get-Location).Path
$desktopLnk = Join-Path ([Environment]::GetFolderPath("Desktop")) "So Hoc Phi.lnk"
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($desktopLnk)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$appDir\open-app.vbs`""
$Shortcut.WorkingDirectory = $appDir
$Shortcut.Description = "Mo So hoc phi & nhat ky hoc tap"
$Shortcut.Save()
```

Sau đó bấm đúp shortcut **"So Hoc Phi"** trên Desktop: server tự khởi động ẩn
(không hiện cửa sổ đen) và trình duyệt tự mở tới `http://localhost:8080`.

| File | Vai trò |
|---|---|
| [start-server.bat](start-server.bat) | Chạy `node server.js` trong đúng thư mục của nó, ghi log ra `storage/server.log` |
| [open-app.vbs](open-app.vbs) | Chạy `start-server.bat` **ẩn**, đợi ~1.2s rồi mở trình duyệt mặc định tới `http://localhost:8080` |
| `So Hoc Phi.lnk` (trên Desktop) | Shortcut trỏ tới `open-app.vbs` |

**Lưu ý chung (áp dụng mọi máy):**
- Ứng dụng không tự chạy khi mở máy/đăng nhập Windows — phải bấm shortcut mỗi
  lần muốn dùng. Muốn tự chạy khi đăng nhập Windows: đặt (hoặc copy) shortcut
  này vào thư mục Startup thay vì Desktop — gõ `shell:startup` vào File
  Explorer để mở thư mục đó. (Một số máy công ty có chính sách chặn cách này
  qua Task Scheduler, nhưng đặt trực tiếp shortcut vào thư mục Startup thường
  vẫn hoạt động vì đó là cơ chế gốc của Windows, không đi qua Task Scheduler.)
- Nếu server đã chạy sẵn mà bấm shortcut thêm lần nữa: trình duyệt vẫn mở tới
  server đang chạy, chỉ có 1 dòng lỗi vô hại (trùng cổng 8080) ghi thêm vào
  log.
- Nếu cổng 8080 trên máy đích bị phần mềm khác chiếm dụng (một số phần mềm
  bảo mật/proxy công ty cũng dùng cổng này), sửa cổng bằng cách đặt biến môi
  trường `PORT` trước khi chạy, ví dụ `set PORT=8090` (CMD) hoặc
  `$env:PORT=8090` (PowerShell) trước `node server.js`; nếu dùng shortcut,
  sửa dòng `node.exe server.js` trong `start-server.bat` thành
  `set PORT=8090 && node.exe server.js`, và sửa `open-app.vbs` để mở
  `http://localhost:8090` thay vì `:8080`.
- Log chạy nền ghi vào `storage/server.log` — kiểm tra file này nếu bấm
  shortcut mà không thấy web lên.
- Muốn dừng server: mở Task Manager, tắt tiến trình `node.exe`, hoặc đóng cửa
  sổ PowerShell/CMD nếu đang chạy `node server.js` thủ công.

### 5. Xác nhận triển khai đúng

```powershell
node --test
```

Chạy bộ test tự động (xem mục "Chạy test tự động" bên dưới) ngay trên máy đích
để xác nhận server + logic ứng dụng hoạt động đúng trước khi bàn giao/sử dụng
thật.

## Cấu trúc thư mục

```
index.html            Giao diện ứng dụng (1 file, tự chứa)
server.js             Server Node: phục vụ trang + API đọc/ghi dữ liệu
start-server.bat       \
open-app.vbs             > cơ chế khởi động bằng shortcut Desktop (xem trên)
storage/
  students.json        Toàn bộ dữ liệu học sinh (nguồn sự thật duy nhất)
  server.log            Log của lần chạy nền gần nhất
test/
  extract.js            Tiện ích trích xuất template/JS từ index.html để test
  static.test.js         Kiểm tra tính toàn vẹn của index.html
  logic.test.js           Test logic ứng dụng (hàm thuần + hành vi Component)
  server.test.js           Test API của server.js (chạy server thật)
```

## API

| Endpoint | Vai trò |
|---|---|
| `GET /` , `/index.html` | Trả về trang ứng dụng |
| `GET /api/students` | Đọc toàn bộ danh sách học sinh từ `storage/students.json` |
| `POST /api/students` | Tạo 1 học sinh mới (body: 1 object học sinh, không phải mảng). Nếu `id` đã tồn tại thì ghi đè đúng bản ghi đó (upsert), không tạo trùng. |
| `PUT /api/students/:id` | Cập nhật 1 học sinh theo id — merge các trường trong body vào bản ghi hiện có trên server, không đụng tới các học sinh khác. `id` trong URL luôn thắng nếu body có gửi kèm `id` khác. |
| `DELETE /api/students/:id` | Xóa 1 học sinh theo id. Gọi với id không tồn tại vẫn trả 200 (idempotent). |

Mỗi thao tác chỉ động tới đúng 1 bản ghi cần thay đổi — không có endpoint nào
ghi đè toàn bộ danh sách cùng lúc, để tránh rủi ro mất dữ liệu nếu client đang
giữ bản sao cũ (ví dụ mở 2 tab trình duyệt).

## Sao lưu dữ liệu

Toàn bộ dữ liệu nằm trong 1 file: `storage/students.json`. Muốn sao lưu hoặc
chuyển sang máy khác, chỉ cần copy file này (và đặt đúng vào thư mục
`storage/` ở máy đích trước khi chạy server).

## Chạy test tự động

```powershell
cd <đường-dẫn-thư-mục-dự-án>
node --test
```

Không cần cài thêm gói nào (dùng `node:test` có sẵn từ Node 18+). Bộ test kiểm
tra 3 lớp: tính toàn vẹn của `index.html` (JSON hợp lệ, cân bằng thẻ, cú pháp
JS), hành vi logic của ứng dụng (thêm/xóa học sinh, lưu, tính tổng học phí...),
và API thật của `server.js` (đọc/ghi file, các trường hợp lỗi).

Test tự sao lưu và khôi phục `storage/students.json` trước/sau khi chạy, không
làm mất dữ liệu thật đang có.

## Xử lý sự cố thường gặp

- **Mở `http://localhost:8080` báo lỗi kết nối**: server chưa chạy — kiểm tra
  `storage/server.log`, hoặc tự chạy `node server.js` trong PowerShell để xem
  lỗi trực tiếp.
- **Trang trắng / lỗi lạ chỉ xảy ra trên Chrome** (ví dụ "Template content not
  set during policy execution"): trên máy công ty thường do một phần mềm bảo
  mật/proxy nội bộ đang dùng chung cổng 8080 (trên máy gốc phát triển app này
  là tiến trình `ScpService`), không phải lỗi ứng dụng. Thử mở Incognito/trình
  duyệt khác để xác nhận, hoặc đổi ứng dụng sang cổng khác (xem mục "Triển
  khai lên một máy local khác" ở trên).
- **Sửa dữ liệu nhưng mất khi tải lại trang**: nhớ bấm nút **"💾 Lưu"** ở màn
  chi tiết học sinh — ứng dụng không tự lưu theo từng phím gõ, chỉ lưu khi
  thêm/xóa học sinh hoặc khi bấm Lưu.
