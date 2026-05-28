# Luyen phat am tieng Trung

Web app React/Vite de luyen nghe va phat am Mandarin tren desktop va iPhone.

## Chay local

```bash
npm install
npm run dev
```

Mo tren may tinh:

```text
http://localhost:5173/
```

## Mo tren iPhone cung Wi-Fi

Double-click file:

```text
Run Chinese App.command
```

Shortcut nay se chay app, mo link tren Mac, va copy link iPhone vao clipboard.

Hoac chay tay:

```bash
npm run dev:phone
```

Vite se in ra URL dang:

```text
http://<IP-may-Mac>:<port>/
```

Mo URL do trong Safari/Chrome tren iPhone.

## Luu y microphone tren iPhone

- Phan nghe va chon dap an khong can microphone, nen chay duoc qua URL LAN.
- Phan noi va check phu thuoc Speech Recognition cua trinh duyet.
- Neu iPhone chan microphone khi mo bang HTTP LAN, hay deploy app len host HTTPS hoac chay qua HTTPS co certificate duoc iPhone tin cay.

## Lenh kiem tra

```bash
npm run lint
npm run build
```

## Deploy GitHub Pages

Ban online dung HTTPS co dinh, khong anh huong shortcut local/iPhone:

```bash
npm run build:pages
```

Thu muc `dist` sau do duoc day len nhanh `gh-pages`.
