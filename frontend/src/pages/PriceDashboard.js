import React, { useEffect, useState, useMemo, useRef } from "react";
import "./PriceDashboard.css";

const PriceDashboard = () => {
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dataSource, setDataSource] = useState("uniswap");
  const [visibleCount, setVisibleCount] = useState(30);
  const [hoveredItem, setHoveredItem] = useState(null);

  // --- 数据加载 (保持不变) ---
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 800));
        const data = generateMockData();
        setPriceData(data);
      } catch (err) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const generateMockData = () => {
    const uniswapData = [];
    const binanceData = [];
    const totalDays = 180;

    for (let i = 1; i <= totalDays; i++) {
      const trend = i * 2;
      const volatility = 40;
      const basePrice = 2500 + Math.sin(i * 0.1) * 200 + trend;

      const date = new Date();
      date.setDate(date.getDate() - (totalDays - i));
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      const dateStr = `${date.getFullYear()}-${month}-${day}`;
      const displayTime = `${month}-${day}`;

      // Uniswap
      const uOpenOffset = (Math.random() - 0.5) * volatility;
      const uCloseOffset = (Math.random() - 0.5) * volatility;
      const uOpen = basePrice + uOpenOffset;
      const uClose = basePrice + uCloseOffset;
      const uHigh =
        Math.max(uOpen, uClose) + Math.random() * (volatility * 0.5);
      const uLow = Math.min(uOpen, uClose) - Math.random() * (volatility * 0.5);
      const uVol = Math.random() * 1000 + 500;

      uniswapData.push({
        id: i,
        timestamp: dateStr,
        displayTime,
        open: uOpen,
        high: uHigh,
        low: uLow,
        close: uClose,
        volume: uVol,
      });

      // Binance
      const bBase = basePrice + (Math.random() - 0.5) * 15;
      const bOpen = bBase + uOpenOffset;
      const bClose = bBase + uCloseOffset;
      const bHigh =
        Math.max(bOpen, bClose) + Math.random() * (volatility * 0.5);
      const bLow = Math.min(bOpen, bClose) - Math.random() * (volatility * 0.5);
      const bVol = uVol * 1.5;

      binanceData.push({
        id: i,
        timestamp: dateStr,
        displayTime,
        open: bOpen,
        high: bHigh,
        low: bLow,
        close: bClose,
        volume: bVol,
      });
    }
    return { uniswap: uniswapData, binance: binanceData };
  };

  const fullData = useMemo(() => {
    if (!priceData) return [];
    return priceData[dataSource];
  }, [priceData, dataSource]);

  const activeData = useMemo(() => {
    if (!fullData || !fullData.length) return [];
    const safeCount = Math.min(visibleCount, fullData.length);
    return fullData.slice(-safeCount);
  }, [fullData, visibleCount]);

  const currentStats = useMemo(() => {
    if (!activeData || !activeData.length) return null;
    const latest = activeData[activeData.length - 1];
    const allHighs = activeData.map((d) => d.high);
    const maxPrice = Math.max(...allHighs);
    const change = latest.close - latest.open;
    const changePercent = (change / latest.open) * 100;

    return {
      price: latest.close,
      high: latest.high,
      low: latest.low,
      volume: latest.volume,
      change,
      changePercent,
      maxPrice,
    };
  }, [activeData]);

  // --- 尺寸与绘图逻辑 ---

  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // 监听窗口大小变化
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", updateSize);

    // 关键：延迟一下确保 DOM 渲染完毕后再计算，防止高度为 0
    const timer = setTimeout(updateSize, 0);

    return () => {
      window.removeEventListener("resize", updateSize);
      clearTimeout(timer);
    };
  }, [loading]); // 当 loading 结束时也会触发一次

  const handleZoom = (delta) => {
    if (!fullData || !fullData.length) return;
    setVisibleCount((prev) =>
      Math.max(7, Math.min(prev + delta, fullData.length))
    );
  };

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const handleWheel = (e) => {
      e.preventDefault();
      const zoomStrength = Math.abs(e.deltaY) > 50 ? 5 : 2;
      const direction = e.deltaY > 0 ? 1 : -1;
      handleZoom(direction * zoomStrength);
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [fullData]);

  // 生成绘图点
  const { points, yTicks } = useMemo(() => {
    if (!activeData.length || !dimensions.width || !dimensions.height)
      return { points: [], yTicks: [] };

    const paddingY = 30; // 增加一点上下留白
    const minPrice = Math.min(...activeData.map((d) => d.low));
    const maxPrice = Math.max(...activeData.map((d) => d.high));
    const range = maxPrice - minPrice;
    const safeRange = range === 0 ? 1 : range;

    const getY = (price) => {
      const ratio = (price - minPrice) / safeRange;
      const drawHeight = dimensions.height - paddingY * 2;
      return dimensions.height - paddingY - ratio * drawHeight;
    };

    const count = activeData.length;
    const xStep = dimensions.width / count;
    const candleWidth = Math.max(1, Math.min(xStep * 0.7, 40));

    const points = activeData.map((d, i) => ({
      ...d,
      x: i * xStep + xStep / 2,
      xStart: i * xStep,
      yOpen: getY(d.open),
      yClose: getY(d.close),
      yHigh: getY(d.high),
      yLow: getY(d.low),
      width: candleWidth,
      isRising: d.close >= d.open,
    }));

    const yTicks = [];
    for (let i = 0; i <= 5; i++) {
      const val = minPrice + (safeRange * i) / 5;
      yTicks.push({ val, y: getY(val) });
    }

    return { points, yTicks };
  }, [activeData, dimensions]);

  const handleMouseMove = (e) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  // 恢复原来逻辑：鼠标悬停在特定蜡烛上
  const handleMouseEnterPoint = (point) => {
    setHoveredItem(point);
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  // 查找当前 hover 的数据（用于 Tooltip）
  const tooltipData = hoveredItem;

  if (loading)
    return <div className="loading-screen">Loading Market Data...</div>;
  if (error) return <div className="error-screen">{error}</div>;

  return (
    <div className="dashboard-container">
      {/* 1. Header (保持你的新样式) */}
      <header className="dashboard-header">
        <div className="pair-info-group">
          <div className="coin-icon">ETH</div>
          <div className="coin-details">
            <h2 className="pair-title">ETH / USDT</h2>
            <div className="tags">
              <span className="tag-source">
                {dataSource === "uniswap" ? "Uniswap V3" : "Binance"}
              </span>
            </div>
          </div>
        </div>

        {currentStats && (
          <div className="stats-group">
            <div className="stat-block">
              <span
                className={`current-price ${
                  currentStats.change >= 0 ? "text-up" : "text-down"
                }`}
              >
                ${currentStats.price.toFixed(2)}
              </span>
              <span className="stat-label">Last Price</span>
            </div>
            <div className="stat-block">
              <span
                className={`stat-value ${
                  currentStats.change >= 0 ? "text-up" : "text-down"
                }`}
              >
                {currentStats.change >= 0 ? "+" : ""}
                {currentStats.changePercent.toFixed(2)}%
              </span>
              <span className="stat-label">24h Change</span>
            </div>
            <div className="stat-block">
              <span className="stat-value text-normal">
                ${currentStats.high.toFixed(2)}
              </span>
              <span className="stat-label">24h High</span>
            </div>
            <div className="stat-block">
              <span className="stat-value text-normal">
                ${currentStats.volume.toFixed(0)}
              </span>
              <span className="stat-label">24h Volume</span>
            </div>
          </div>
        )}
      </header>

      {/* 2. Main Content */}
      <main className="dashboard-main">
        {/* Left: Chart Section */}
        <section className="chart-card">
          {/* Toolbar (保持你的新样式) */}
          <div className="chart-toolbar">
            <div className="toolbar-group">
              <span className="toolbar-label">Time</span>
              <div className="time-btns">
                {[7, 30, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => setVisibleCount(d)}
                    className={`time-btn ${visibleCount === d ? "active" : ""}`}
                  >
                    {d}D
                  </button>
                ))}
              </div>
            </div>

            <div className="toolbar-group">
              <div className="segmented-control">
                <button
                  className={dataSource === "uniswap" ? "active-uni" : ""}
                  onClick={() => setDataSource("uniswap")}
                >
                  Uniswap
                </button>
                <div className="divider"></div>
                <button
                  className={dataSource === "binance" ? "active-bin" : ""}
                  onClick={() => setDataSource("binance")}
                >
                  Binance
                </button>
              </div>
            </div>
          </div>

          {/* Chart Canvas */}
          <div
            className="chart-area"
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* 
                修正重点：移除了 .ohlc-legend，改为下方的 floating tooltip 
                同时确保 svg 占满空间
             */}

            <svg width="100%" height="100%" className="chart-svg">
              {/* Grid Lines */}
              {yTicks.map((t, i) => (
                <g key={i}>
                  <line
                    x1="0"
                    y1={t.y}
                    x2="100%"
                    y2={t.y}
                    className="grid-line"
                  />
                  <text
                    x={dimensions.width - 6}
                    y={t.y - 4}
                    className="axis-label"
                  >
                    {t.val.toFixed(0)}
                  </text>
                </g>
              ))}

              {/* Candles */}
              {points.map((p) => (
                <g key={p.id} className="candle-group">
                  <line
                    x1={p.x}
                    y1={p.yHigh}
                    x2={p.x}
                    y2={p.yLow}
                    className={p.isRising ? "stroke-up" : "stroke-down"}
                  />
                  <rect
                    x={p.x - p.width / 2}
                    y={Math.min(p.yOpen, p.yClose)}
                    width={p.width}
                    height={Math.max(1, Math.abs(p.yOpen - p.yClose))}
                    className={p.isRising ? "fill-up" : "fill-down"}
                    shapeRendering="crispEdges"
                  />
                  {/* Invisible Hit Area - 恢复这个逻辑用于触发 tooltip */}
                  <rect
                    x={p.xStart}
                    y="0"
                    width={dimensions.width / points.length}
                    height="100%"
                    fill="transparent"
                    onMouseEnter={() => handleMouseEnterPoint(p)}
                  />
                </g>
              ))}

              {/* Crosshair Line (可选，随鼠标位置) */}
              {tooltipData && (
                <line
                  x1={tooltipData.x}
                  y1="0"
                  x2={tooltipData.x}
                  y2="100%"
                  className="crosshair-line"
                />
              )}
            </svg>

            {/* X Axis Time Labels */}
            <div className="x-axis">
              {points
                .filter((_, i) => i % Math.ceil(points.length / 6) === 0)
                .map((p) => (
                  <span key={p.id} style={{ left: p.x }}>
                    {p.displayTime}
                  </span>
                ))}
            </div>

            {/* 恢复：Floating Tooltip (跟随逻辑) */}
            {tooltipData && (
              <div
                className="floating-tooltip"
                style={{
                  // 简单的防溢出逻辑：如果靠右，就显示在左边
                  left:
                    mousePos.x > dimensions.width / 2
                      ? mousePos.x - 180
                      : mousePos.x + 20,
                  top: Math.min(mousePos.y, dimensions.height - 150),
                }}
              >
                <div className="tooltip-date">{tooltipData.timestamp}</div>
                <div className="tooltip-row">
                  <span>Open:</span>
                  <span className="font-mono">
                    {tooltipData.open.toFixed(2)}
                  </span>
                </div>
                <div className="tooltip-row">
                  <span>High:</span>
                  <span className="font-mono">
                    {tooltipData.high.toFixed(2)}
                  </span>
                </div>
                <div className="tooltip-row">
                  <span>Low:</span>
                  <span className="font-mono">
                    {tooltipData.low.toFixed(2)}
                  </span>
                </div>
                <div className="tooltip-row">
                  <span>Close:</span>
                  <span
                    className={`font-mono ${
                      tooltipData.isRising ? "text-up" : "text-down"
                    }`}
                  >
                    {tooltipData.close.toFixed(2)}
                  </span>
                </div>
                <div className="tooltip-row">
                  <span>Vol:</span>
                  <span className="font-mono">
                    {tooltipData.volume.toFixed(0)}
                  </span>
                </div>
                <div className="tooltip-row">
                  <span>Chg:</span>
                  <span
                    className={`font-mono ${
                      tooltipData.isRising ? "text-up" : "text-down"
                    }`}
                  >
                    {(tooltipData.close - tooltipData.open).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right: Order List (保持不变) */}
        <aside className="table-card">
          <div className="table-header">
            <h3>Market Trades</h3>
          </div>
          <div className="table-body">
            <table>
              <thead>
                <tr>
                  <th className="text-left">Time</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {[...activeData].reverse().map((row) => (
                  <tr
                    key={row.id}
                    className={
                      hoveredItem && hoveredItem.id === row.id
                        ? "row-hover"
                        : ""
                    }
                    onMouseEnter={() => setHoveredItem(row)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <td className="text-left text-dim">{row.displayTime}</td>
                    <td
                      className={`text-right ${
                        row.close >= row.open ? "text-up" : "text-down"
                      }`}
                    >
                      {row.close.toFixed(2)}
                    </td>
                    <td className="text-right text-normal">
                      {row.volume.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default PriceDashboard;
