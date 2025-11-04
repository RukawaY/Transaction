# Transaction
Project for Software Requirements Engineering: Non-Atomic Blockchain Transaction Identification Website

## How to Run

Firstly make sure `Docker` and `Docker Compose` are installed on your machine.

Switch to the root directory and run:

```bash
docker-compose up --build
```

Then the website will be available at `http://127.0.0.1`.

## 前端TODO

主要位于以下4个页面中：

- frontend/src/pages/ArbitrageAnalysis.css
- frontend/src/pages/ArbitrageAnalysis.js
- frontend/src/pages/PriceDashboard.css
- frontend/src/pages/PriceDashboard.js

注：修改了页面内容之后，记得去 `frontend/src/utils/searchData.js` 里面修改对应的内容，确保搜索功能正常工作！