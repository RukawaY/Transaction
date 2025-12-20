import React, { useEffect, useState } from 'react';
import './ArbitrageAnalysis.css';

// API基础URL（根据项目配置调整）
// 如果 REACT_APP_API_URL 未设置，使用相对路径（通过 nginx 代理）
// 否则使用指定的 URL（用于本地开发）
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// 格式化函数（在组件外部定义，以便在子组件中使用）
const formatDateTime = (timestamp) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined) return '-';
  return Number(num).toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

const formatProfit = (profit) => {
  if (profit === null || profit === undefined) return '-';
  const num = Number(profit);
  if (num >= 0) {
    return `+${formatNumber(num, 4)} USDT`;
  }
  return `${formatNumber(num, 4)} USDT`;
};

function ArbitrageAnalysis() {
  const [scrolled, setScrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 统计数据
  const [statistics, setStatistics] = useState({
    totalOpportunities: 0,
    totalProfit: 0,
    averageProfitRate: 0
  });
  
  // 套利行为列表
  const [behaviors, setBehaviors] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);
  
  // 套利机会数据（用于可视化）
  const [opportunities, setOpportunities] = useState([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false);
  
  // 筛选条件
  const [filters, setFilters] = useState({
    minProfit: '',
    sortBy: 'profit', // profit, buy_timestamp, sell_timestamp
    sortOrder: 'desc' // asc, desc
  });
  
  // 套利机会可视化筛选条件
  const [opportunityFilters, setOpportunityFilters] = useState({
    minProfitRate: '', // 最低利润率（百分比，如 0.5 表示 0.5%）
    startTime: '', // ISO 时间字符串
    endTime: '' // ISO 时间字符串
  });
  
  // 当前 hover 的套利机会
  const [hoveredOpportunity, setHoveredOpportunity] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // 获取统计数据
  const fetchStatistics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/arbitrage/statistics`);
      if (!response.ok) {
        throw new Error('获取统计数据失败');
      }
      const data = await response.json();
      setStatistics({
        totalOpportunities: data.total_opportunities || 0,
        totalProfit: data.total_profit || 0,
        averageProfitRate: data.average_profit_rate || 0
      });
    } catch (err) {
      console.error('获取统计数据错误:', err);
      setError('获取统计数据失败，请稍后重试');
    }
  };

  // 获取套利行为列表
  const fetchBehaviors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: pageSize.toString(),
        sort_by: filters.sortBy,
        sort_order: filters.sortOrder
      });
      
      if (filters.minProfit) {
        params.append('min_profit', filters.minProfit);
      }
      
      const response = await fetch(`${API_BASE_URL}/arbitrage/behaviors?${params}`);
      if (!response.ok) {
        throw new Error('获取套利行为列表失败');
      }
      const data = await response.json();
      setBehaviors(data.behaviors || []);
      setTotalPages(data.total_pages || 1);
      setError(null);
    } catch (err) {
      console.error('获取套利行为列表错误:', err);
      setError('获取套利行为列表失败，请稍后重试');
      setBehaviors([]);
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载数据
  useEffect(() => {
    fetchStatistics();
    fetchBehaviors();
    fetchOpportunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 当套利机会筛选条件改变时重新获取数据
  useEffect(() => {
    fetchOpportunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityFilters]);

  // 当筛选条件或页码改变时重新获取数据
  useEffect(() => {
    if (currentPage === 1) {
      fetchBehaviors();
    } else {
      setCurrentPage(1);
    }
  }, [filters]);

  useEffect(() => {
    fetchBehaviors();
  }, [currentPage]);

  // 处理滚动
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 获取套利机会数据（用于可视化）
  const fetchOpportunities = async () => {
    try {
      setOpportunitiesLoading(true);
      const params = new URLSearchParams();
      
      if (opportunityFilters.minProfitRate) {
        // 将百分比转换为小数（例如 0.5% -> 0.005）
        const rate = parseFloat(opportunityFilters.minProfitRate) / 100;
        params.append('min_profit_rate', rate.toString());
      }
      
      if (opportunityFilters.startTime) {
        params.append('start_time', opportunityFilters.startTime);
      }
      
      if (opportunityFilters.endTime) {
        params.append('end_time', opportunityFilters.endTime);
      }
      
      // 不传 page 和 page_size，获取所有匹配的记录
      const response = await fetch(`${API_BASE_URL}/arbitrage/opportunities?${params}`);
      if (!response.ok) {
        throw new Error('获取套利机会列表失败');
      }
      const data = await response.json();
      setOpportunities(data.opportunities || []);
      setError(null);
    } catch (err) {
      console.error('获取套利机会列表错误:', err);
      setError('获取套利机会列表失败，请稍后重试');
      setOpportunities([]);
    } finally {
      setOpportunitiesLoading(false);
    }
  };

  return (
    <div className="page-container">
      {/* Hero Section - Full Screen */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">套利分析</h1>
          <p className="hero-subtitle">非原子套利行为识别与利润分析</p>
          
          {/* 统计卡片 */}
          <div className="analysis-placeholder">
            <div className="animated-analysis">
              <div className="data-card card-1">
                <div className="card-shimmer"></div>
                <div className="card-content">
                  <div className="metric-label">识别套利次数</div>
                  <div className="metric-value">
                    {loading ? '---' : formatNumber(statistics.totalOpportunities, 0)}
                  </div>
                </div>
              </div>
              <div className="data-card card-2">
                <div className="card-shimmer"></div>
                <div className="card-content">
                  <div className="metric-label">总潜在利润</div>
                  <div className="metric-value">
                    {loading ? '--- USDT' : `${formatNumber(statistics.totalProfit, 2)} USDT`}
                  </div>
                </div>
              </div>
              <div className="data-card card-3">
                <div className="card-shimmer"></div>
                <div className="card-content">
                  <div className="metric-label">平均利润率</div>
                  <div className="metric-value">
                    {loading ? '---%' : `${formatNumber(statistics.averageProfitRate, 2)}%`}
                  </div>
                </div>
              </div>
              <div className="connection-line line-1"></div>
              <div className="connection-line line-2"></div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="scroll-indicator">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5V19M12 19L5 12M12 19L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>向下滑动查看更多</span>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="content-section">
        <div className="content-wrapper">
          {/* 套利机会可视化 */}
          <div className="opportunities-visualization">
            <h2 className="section-title">套利机会识别</h2>
            <p className="section-subtitle">时间轴可视化 - 识别有利可图的套利机会</p>
            
            {/* 筛选器 */}
            <div className="opportunity-filters">
              <div className="filter-group">
                <label htmlFor="minProfitRate">最低利润率 (%):</label>
                <input
                  id="minProfitRate"
                  type="number"
                  placeholder="0.5"
                  step="0.1"
                  min="0"
                  value={opportunityFilters.minProfitRate}
                  onChange={(e) => setOpportunityFilters({ ...opportunityFilters, minProfitRate: e.target.value })}
                />
              </div>
              <div className="filter-group">
                <label htmlFor="startTime">起始时间:</label>
                <input
                  id="startTime"
                  type="datetime-local"
                  value={opportunityFilters.startTime ? opportunityFilters.startTime.slice(0, 16) : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setOpportunityFilters({ 
                      ...opportunityFilters, 
                      startTime: value ? new Date(value).toISOString() : '' 
                    });
                  }}
                />
              </div>
              <div className="filter-group">
                <label htmlFor="endTime">结束时间:</label>
                <input
                  id="endTime"
                  type="datetime-local"
                  value={opportunityFilters.endTime ? opportunityFilters.endTime.slice(0, 16) : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setOpportunityFilters({ 
                      ...opportunityFilters, 
                      endTime: value ? new Date(value).toISOString() : '' 
                    });
                  }}
                />
              </div>
              <button 
                className="reset-filters-btn"
                onClick={() => setOpportunityFilters({ minProfitRate: '', startTime: '', endTime: '' })}
              >
                重置筛选
              </button>
            </div>

            {/* 时间轴可视化 */}
            {opportunitiesLoading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>加载中...</p>
              </div>
            ) : opportunities.length === 0 ? (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p>暂无套利机会数据</p>
              </div>
            ) : (
              <div className="timeline-container">
                <TimelineVisualization 
                  opportunities={opportunities}
                  onHover={(opp, position) => {
                    setHoveredOpportunity(opp);
                    if (position) {
                      setTooltipPosition(position);
                    }
                  }}
                  hoveredOpportunity={hoveredOpportunity}
                />
                {hoveredOpportunity && tooltipPosition.x > 0 && (
                  <div 
                    className="opportunity-tooltip"
                    style={{
                      left: `${tooltipPosition.x}px`,
                      top: `${Math.max(10, tooltipPosition.y - 15)}px`,
                      transform: 'translate(-50%, -100%)'
                    }}
                  >
                    <h4>套利机会详情</h4>
                    <div className="tooltip-content">
                      <p><strong>时间:</strong> {formatDateTime(hoveredOpportunity.timestamp)}</p>
                      <p><strong>方向:</strong> 
                        <span className={`direction-badge ${hoveredOpportunity.direction === 'cex->dex' ? 'cex-dex' : 'dex-cex'}`}>
                          {hoveredOpportunity.direction === 'cex->dex' ? 'CEX→DEX' : 'DEX→CEX'}
                        </span>
                      </p>
                      <p><strong>Uniswap 价格:</strong> {formatNumber(hoveredOpportunity.uniswap_price, 4)}</p>
                      <p><strong>Binance 价格:</strong> {formatNumber(hoveredOpportunity.binance_price, 4)}</p>
                      <p><strong>价格差:</strong> {formatNumber(hoveredOpportunity.price_diff_percent, 2)}%</p>
                      <p><strong>预期利润:</strong> {formatProfit(hoveredOpportunity.profit)}</p>
                      <p><strong>利润率:</strong> {formatNumber(hoveredOpportunity.profit_rate, 2)}%</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 数据分析面板 */}
            {!opportunitiesLoading && opportunities.length > 0 && (
              <OpportunityDataAnalysis opportunities={opportunities} />
            )}
          </div>

          <h2 className="section-title">套利行为分析</h2>
          
          {/* 错误提示 */}
          {error && (
            <div className="error-message">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
              <button onClick={() => { fetchStatistics(); fetchBehaviors(); }}>重试</button>
            </div>
          )}

          {/* 筛选器 */}
          <div className="filters-container">
            <div className="filter-group">
              <label htmlFor="minProfit">最小利润 (USDT):</label>
              <input
                id="minProfit"
                type="number"
                placeholder="0"
                step="0.01"
                value={filters.minProfit}
                onChange={(e) => setFilters({ ...filters, minProfit: e.target.value })}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="sortBy">排序方式:</label>
              <select
                id="sortBy"
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
              >
                <option value="profit">按利润</option>
                <option value="buy_timestamp">按买入时间</option>
                <option value="sell_timestamp">按卖出时间</option>
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="sortOrder">排序顺序:</label>
              <select
                id="sortOrder"
                value={filters.sortOrder}
                onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value })}
              >
                <option value="desc">降序</option>
                <option value="asc">升序</option>
              </select>
            </div>
            <button 
              className="reset-filters-btn"
              onClick={() => setFilters({ minProfit: '', sortBy: 'profit', sortOrder: 'desc' })}
            >
              重置筛选
            </button>
          </div>

          {/* 套利行为表格 */}
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>加载中...</p>
            </div>
          ) : behaviors.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p>暂无套利行为数据</p>
            </div>
          ) : (
            <>
              <div className="table-container">
                <table className="opportunities-table">
                  <thead>
                    <tr>
                      <th>套利方向</th>
                      <th>买入时间</th>
                      <th>卖出时间</th>
                      <th>Uniswap 价格</th>
                      <th>Binance 价格</th>
                      <th>价格差 (%)</th>
                      <th>潜在利润 (USDT)</th>
                      <th>利润率 (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {behaviors.map((behavior, index) => (
                      <tr key={behavior.id || index}>
                        <td>
                          <span className={`direction-badge ${behavior.direction === 'cex->dex' ? 'cex-dex' : 'dex-cex'}`}>
                            {behavior.direction === 'cex->dex' ? 'CEX→DEX' : 'DEX→CEX'}
                          </span>
                        </td>
                        <td>{formatDateTime(behavior.buy_timestamp)}</td>
                        <td>{formatDateTime(behavior.sell_timestamp)}</td>
                        <td>{formatNumber(behavior.uniswap_price, 4)}</td>
                        <td>{formatNumber(behavior.binance_price, 4)}</td>
                        <td className={behavior.price_diff_percent >= 0 ? 'positive' : 'negative'}>
                          {behavior.price_diff_percent >= 0 ? '+' : ''}{formatNumber(behavior.price_diff_percent, 2)}%
                        </td>
                        <td className={behavior.profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                          {formatProfit(behavior.profit)}
                        </td>
                        <td className={behavior.profit_rate >= 0 ? 'positive' : 'negative'}>
                          {behavior.profit_rate >= 0 ? '+' : ''}{formatNumber(behavior.profit_rate, 2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页器 */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    上一页
                  </button>
                  <span className="pagination-info">
                    第 {currentPage} 页，共 {totalPages} 页
                  </span>
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

// 时间轴可视化组件
function TimelineVisualization({ opportunities, onHover, hoveredOpportunity }) {
  const containerRef = React.useRef(null);
  const svgRef = React.useRef(null);
  const [timeGranularity, setTimeGranularity] = React.useState(5); // 时间粒度（分钟），默认5分钟
  const [dimensions, setDimensions] = React.useState({ width: 1200, height: 300 }); // 增加高度以容纳垂直排列的点
  const [scale, setScale] = React.useState(1); // 缩放比例，1表示原始大小
  const [panOffset, setPanOffset] = React.useState(0); // 平移偏移量（像素）
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, offset: 0 });
  const [isHoveringTimeline, setIsHoveringTimeline] = React.useState(false); // 鼠标是否在时间轴区域内
  const [priceData, setPriceData] = React.useState(null); // ETH价格数据
  const [priceDataLoading, setPriceDataLoading] = React.useState(false);

  // 获取ETH价格数据
  const fetchPriceData = React.useCallback(async () => {
    if (opportunities.length === 0) return;
    
    try {
      setPriceDataLoading(true);
      // 计算时间范围
      const sortedOpps = [...opportunities]
        .map(opp => ({ ...opp, timestamp: new Date(opp.timestamp) }))
        .sort((a, b) => a.timestamp - b.timestamp);
      
      if (sortedOpps.length === 0) return;
      
      const minTime = sortedOpps[0].timestamp;
      const maxTime = sortedOpps[sortedOpps.length - 1].timestamp;
      
      // 计算日期范围（用于API查询）
      const startDate = new Date(minTime);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(maxTime);
      endDate.setHours(23, 59, 59, 999);
      
      // 构建API URL
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';
      const apiBase = backendUrl.replace(/\/$/, '');
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const response = await fetch(`${apiBase}/api/price-data?start_date=${startDateStr}&end_date=${endDateStr}`);
      if (!response.ok) {
        throw new Error(`获取价格数据失败: ${response.status}`);
      }
      const data = await response.json();
      
      // 使用Uniswap数据，如果没有则使用Binance数据
      const priceSeries = data.uniswap && data.uniswap.length > 0 
        ? data.uniswap 
        : (data.binance && data.binance.length > 0 ? data.binance : []);
      
      // 规范化数据
      const normalized = priceSeries
        .filter(Boolean)
        .map(item => ({
          timestamp: new Date(item.timestamp),
          price: Number(item.close || 0)
        }))
        .filter(item => item.price > 0 && !isNaN(item.timestamp.getTime()))
        .sort((a, b) => a.timestamp - b.timestamp);
      
      setPriceData(normalized);
    } catch (err) {
      console.error('获取价格数据错误:', err);
      setPriceData(null);
    } finally {
      setPriceDataLoading(false);
    }
  }, [opportunities]);

  // 当套利机会数据变化时获取价格数据
  React.useEffect(() => {
    fetchPriceData();
  }, [fetchPriceData]);

  // 计算利润率范围（用于颜色映射）- 需要在updateDimensions之前计算
  const profitRatesForHeight = opportunities.length > 0 
    ? opportunities.map(opp => opp.profit_rate || 0)
    : [0];
  const minProfitRateForHeight = Math.min(...profitRatesForHeight);
  const maxProfitRateForHeight = Math.max(...profitRatesForHeight);
  const profitRateRangeForHeight = maxProfitRateForHeight - minProfitRateForHeight;

  // 根据利润率获取颜色和大小（用于高度计算）
  const getOpportunityStyleForHeight = (profitRate) => {
    if (profitRateRangeForHeight === 0) {
      return { color: '#6366f1', size: 8 };
    }
    const normalized = (profitRate - minProfitRateForHeight) / profitRateRangeForHeight;
    const size = 6 + normalized * 10; // 6-16px
    return { color: '#6366f1', size };
  };

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth - 80;
        
        // 根据实际计算出的最高点来动态计算高度
        let calculatedHeight = 300; // 默认最小高度
        
        if (opportunities.length > 0) {
          const sortedOpps = [...opportunities]
            .map(opp => ({ 
              ...opp, 
              timestamp: new Date(opp.timestamp),
              profit_rate: opp.profit_rate || 0
            }))
            .sort((a, b) => a.timestamp - b.timestamp);
          
          const granularityMs = timeGranularity * 60 * 1000;
          const grouped = {};
          
          // 按时间粒度分组
          sortedOpps.forEach(opp => {
            const slotKey = Math.floor(opp.timestamp.getTime() / granularityMs);
            if (!grouped[slotKey]) {
              grouped[slotKey] = [];
            }
            grouped[slotKey].push(opp);
          });
          
          // 计算每个时间槽中点的最高位置
          const minGap = 6;
          const levelGap = 8;
          const strokeWidth = 2;
          const baselineY = 1000; // 使用一个大的临时baselineY值来计算
          
          // 获取利润率等级
          const getProfitRateLevel = (profitRate) => {
            if (profitRateRangeForHeight === 0) return 0;
            const normalized = (profitRate - minProfitRateForHeight) / profitRateRangeForHeight;
            if (normalized < 0.3) return 0;
            if (normalized < 0.6) return 1;
            if (normalized < 0.8) return 2;
            return 3;
          };
          
          // 计算每个点的实际占用半径
          const getPointFullRadius = (opp) => {
            const style = getOpportunityStyleForHeight(opp.profit_rate);
            return style.size + strokeWidth;
          };
          
          let minY = baselineY; // 最高的点（Y值最小）
          
          // 遍历每个时间槽，计算最高点
          Object.keys(grouped).forEach(slotKey => {
            const slotOpportunities = grouped[slotKey];
            const slotCount = slotOpportunities.length;
            
            if (slotCount === 1) {
              // 如果只有一个点，在基线上
              const pointFullRadius = getPointFullRadius(slotOpportunities[0]);
              const topY = baselineY - pointFullRadius;
              minY = Math.min(minY, topY);
            } else {
              // 按等级分组
              const levelGroups = { 0: [], 1: [], 2: [], 3: [] };
              slotOpportunities.forEach(opp => {
                const level = getProfitRateLevel(opp.profit_rate || 0);
                levelGroups[level].push(opp);
              });
              
              // 每个等级内的点按利润率升序排列
              Object.keys(levelGroups).forEach(level => {
                levelGroups[level].sort((a, b) => {
                  const rateA = a.profit_rate || 0;
                  const rateB = b.profit_rate || 0;
                  return rateA - rateB;
                });
              });
              
              // 统一收集所有点
              const allOpps = [];
              [0, 1, 2, 3].forEach(level => {
                allOpps.push(...levelGroups[level]);
              });
              
              // 计算所有点的位置
              let currentY = baselineY;
              allOpps.forEach((opp, index) => {
                const pointFullRadius = getPointFullRadius(opp);
                const currentLevel = getProfitRateLevel(opp.profit_rate || 0);
                
                if (index === 0) {
                  currentY = baselineY;
                } else {
                  const prevOpp = allOpps[index - 1];
                  const prevFullRadius = getPointFullRadius(prevOpp);
                  const prevLevel = getProfitRateLevel(prevOpp.profit_rate || 0);
                  
                  const isLevelChange = currentLevel !== prevLevel;
                  const extraGap = isLevelChange ? levelGap : 0;
                  const radiusBasedGap = Math.max(prevFullRadius, pointFullRadius) * 0.05;
                  const dynamicGap = minGap + radiusBasedGap + extraGap;
                  
                  currentY = currentY - prevFullRadius - dynamicGap - pointFullRadius;
                }
                
                // 记录最高点（Y值最小）
                const topY = currentY - pointFullRadius;
                minY = Math.min(minY, topY);
              });
            }
          });
          
          // 计算所需高度：baselineY - minY + 底部边距(40) + 顶部边距(20)
          const heightFromBaseline = baselineY - minY;
          calculatedHeight = Math.max(300, heightFromBaseline + 40 + 20);
        }
        
        setDimensions({
          width: Math.max(width, 1200),
          height: calculatedHeight
        });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [opportunities, timeGranularity, profitRateRangeForHeight, minProfitRateForHeight, maxProfitRateForHeight]);

  // 处理拖拽移动
  const handleMouseMove = React.useCallback((e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.x;
    setPanOffset(dragStart.offset + deltaX);
  }, [isDragging, dragStart]);

  // 处理拖拽结束
  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  // 添加全局鼠标事件监听
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 格式化日期时间
  const formatDateTimeShort = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 解析时间并排序（在所有 Hooks 之前）
  const sortedOpportunities = opportunities.length === 0 ? [] : [...opportunities]
    .map(opp => ({
      ...opp,
      timestamp: new Date(opp.timestamp),
      profit_rate: opp.profit_rate || 0
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  // 计算时间范围（处理空数组情况）
  const minTime = sortedOpportunities.length > 0 ? sortedOpportunities[0].timestamp : new Date();
  const maxTime = sortedOpportunities.length > 0 ? sortedOpportunities[sortedOpportunities.length - 1].timestamp : new Date();
  const timeRange = sortedOpportunities.length > 0 ? maxTime.getTime() - minTime.getTime() : 0;

  // 计算价格曲线坐标
  const priceCurvePoints = React.useMemo(() => {
    if (!priceData || priceData.length === 0 || timeRange === 0) return [];
    
    // 过滤出在时间范围内的价格数据
    const filteredPrices = priceData.filter(p => {
      const priceTime = p.timestamp.getTime();
      return priceTime >= minTime.getTime() && priceTime <= maxTime.getTime();
    });
    
    if (filteredPrices.length === 0) return [];
    
    // 计算价格范围
    const prices = filteredPrices.map(p => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;
    
    // 价格曲线绘制在图表上方，使用顶部80%的空间
    const priceAreaTop = 20;
    const priceAreaHeight = (dimensions.height - 40 - priceAreaTop) * 0.8;
    const priceAreaBottom = priceAreaTop + priceAreaHeight;
    
    // 计算每个价格点的坐标
    const padding = 60;
    const chartWidth = dimensions.width - padding * 2;
    return filteredPrices.map(p => {
      // 直接计算X坐标，避免依赖getX函数
      let x = padding;
      if (timeRange > 0) {
        const ratio = (p.timestamp.getTime() - minTime.getTime()) / timeRange;
        const originalX = padding + chartWidth * ratio;
        x = originalX * scale + panOffset;
      }
      const priceRatio = (p.price - minPrice) / priceRange;
      // Y坐标：价格越高，Y值越小（SVG坐标系）
      const y = priceAreaBottom - priceRatio * priceAreaHeight;
      return { x, y, price: p.price, timestamp: p.timestamp };
    });
  }, [priceData, minTime, maxTime, timeRange, dimensions.width, dimensions.height, scale, panOffset]);
  
  // 计算价格范围（用于Y轴标签）
  const priceRange = React.useMemo(() => {
    if (!priceData || priceData.length === 0) return null;
    const filteredPrices = priceData.filter(p => {
      const priceTime = p.timestamp.getTime();
      return priceTime >= minTime.getTime() && priceTime <= maxTime.getTime();
    });
    if (filteredPrices.length === 0) return null;
    const prices = filteredPrices.map(p => p.price);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      range: Math.max(...prices) - Math.min(...prices) || 1
    };
  }, [priceData, minTime, maxTime]);

  // 计算利润率范围（用于颜色映射）
  const profitRates = sortedOpportunities.map(opp => opp.profit_rate);
  const minProfitRate = Math.min(...profitRates);
  const maxProfitRate = Math.max(...profitRates);
  const profitRateRange = maxProfitRate - minProfitRate;

  // 根据利润率获取颜色和大小
  const getOpportunityStyle = (profitRate) => {
    if (profitRateRange === 0) {
      return { color: '#6366f1', size: 8 };
    }
    const normalized = (profitRate - minProfitRate) / profitRateRange;
    
    // 根据利润率返回不同颜色：低利润率（蓝色）到高利润率（红色）
    let color;
    if (normalized < 0.3) {
      color = '#6366f1'; // 蓝色 - 低利润率
    } else if (normalized < 0.6) {
      color = '#10b981'; // 绿色 - 中等利润率
    } else if (normalized < 0.8) {
      color = '#f59e0b'; // 橙色 - 较高利润率
    } else {
      color = '#ef4444'; // 红色 - 高利润率
    }
    
    // 根据利润率返回不同大小
    const size = 6 + normalized * 10; // 6-16px
    
    return { color, size };
  };

  // 计算时间对应的 X 坐标（考虑缩放和平移）
  const getX = (timestamp) => {
    const padding = 60;
    const chartWidth = dimensions.width - padding * 2;
    if (timeRange === 0) return padding;
    const ratio = (timestamp.getTime() - minTime.getTime()) / timeRange;
    // 计算原始位置（未缩放时）
    const originalX = padding + chartWidth * ratio;
    // 应用缩放和平移
    // 缩放后的位置 = 原始位置 * scale + 平移偏移
    return originalX * scale + panOffset;
  };

  // 将套利机会按时间粒度分组，并计算每个机会的垂直位置
  const getOpportunityPositions = React.useMemo(() => {
    if (sortedOpportunities.length === 0) return [];
    
    const granularityMs = timeGranularity * 60 * 1000; // 转换为毫秒
    const grouped = {}; // key: 时间槽索引, value: 该槽内的机会数组
    
    // 按时间粒度分组
    sortedOpportunities.forEach(opp => {
      const slotKey = Math.floor(opp.timestamp.getTime() / granularityMs);
      if (!grouped[slotKey]) {
        grouped[slotKey] = [];
      }
      grouped[slotKey].push(opp);
    });
    
    // 为每个机会计算位置
    const positions = [];
    const padding = 60;
    const chartWidth = dimensions.width - padding * 2;
    
    Object.keys(grouped).forEach(slotKey => {
      const slotOpportunities = grouped[slotKey];
      const slotCount = slotOpportunities.length;
      
      // 计算该时间槽的中心X坐标（使用第一个机会的时间）
      const slotTime = slotOpportunities[0].timestamp;
      // 直接计算X坐标，避免依赖getX函数
      let x = padding;
      if (timeRange > 0) {
        const ratio = (slotTime.getTime() - minTime.getTime()) / timeRange;
        const originalX = padding + chartWidth * ratio;
        x = originalX * scale + panOffset;
      }
      
      // 计算垂直位置：按利润率等级分组，从下到上排列
      // 统一计算所有点的位置，确保不重叠
      const baselineY = dimensions.height - 40;
      const minGap = 6; // 点之间的最小间隙（像素），进一步减小间距
      const levelGap = 8; // 不同等级之间的额外间隙（像素），进一步减小
      const strokeWidth = 2; // stroke 宽度（非 hover 状态）
      
      // 获取利润率等级：0=低(蓝色), 1=中(绿色), 2=较高(橙色), 3=高(红色)
      const getProfitRateLevel = (profitRate) => {
        if (profitRateRange === 0) return 0;
        const normalized = (profitRate - minProfitRate) / profitRateRange;
        if (normalized < 0.3) return 0; // 低利润率 - 蓝色
        if (normalized < 0.6) return 1; // 中等利润率 - 绿色
        if (normalized < 0.8) return 2; // 较高利润率 - 橙色
        return 3; // 高利润率 - 红色
      };
      
      // 计算每个点的实际占用半径（包括stroke，stroke在圆外面）
      const getPointFullRadius = (opp) => {
        const style = getOpportunityStyle(opp.profit_rate);
        // 实际占用空间 = 圆半径 + stroke宽度（stroke在圆外面）
        return style.size + strokeWidth;
      };
      
      // 按等级分组
      const levelGroups = {
        0: [], // 低利润率
        1: [], // 中等利润率
        2: [], // 较高利润率
        3: []  // 高利润率
      };
      
      slotOpportunities.forEach(opp => {
        const level = getProfitRateLevel(opp.profit_rate || 0);
        levelGroups[level].push(opp);
      });
      
      // 每个等级内的点按利润率升序排列（从低到高）
      Object.keys(levelGroups).forEach(level => {
        levelGroups[level].sort((a, b) => {
          const rateA = a.profit_rate || 0;
          const rateB = b.profit_rate || 0;
          return rateA - rateB; // 升序排列
        });
      });
      
      // 统一收集所有点，按等级从低到高排列
      const allOpps = [];
      [0, 1, 2, 3].forEach(level => {
        allOpps.push(...levelGroups[level]);
      });
      
      if (slotCount === 1) {
        // 如果只有一个点，直接放在基线上
        positions.push({
          opportunity: allOpps[0],
          x,
          y: baselineY,
          slotIndex: parseInt(slotKey),
          indexInSlot: 0,
          totalInSlot: slotCount
        });
      } else {
        // 统一计算所有点的位置：从下到上依次排列
        let currentY = baselineY;
        
        allOpps.forEach((opp, index) => {
          const pointFullRadius = getPointFullRadius(opp);
          const currentLevel = getProfitRateLevel(opp.profit_rate || 0);
          
          if (index === 0) {
            // 第一个点放在基线上
            currentY = baselineY;
          } else {
            // 获取前一个点
            const prevOpp = allOpps[index - 1];
            const prevFullRadius = getPointFullRadius(prevOpp);
            const prevLevel = getProfitRateLevel(prevOpp.profit_rate || 0);
            
            // 如果等级改变，增加额外的等级间隙
            const isLevelChange = currentLevel !== prevLevel;
            const extraGap = isLevelChange ? levelGap : 0;
            
            // 计算两个点之间的间隙
            // 前一个点的上边缘 = currentY - prevFullRadius
            // 当前点的下边缘应该在 = currentY - prevFullRadius - gap
            // 当前点的中心 = currentY - prevFullRadius - gap - pointFullRadius
            // gap = minGap + 基于半径的额外间隙 + 等级间隙
            const radiusBasedGap = Math.max(prevFullRadius, pointFullRadius) * 0.05; // 进一步减小基于半径的间隙
            const dynamicGap = minGap + radiusBasedGap + extraGap;
            
            // 更新当前Y坐标
            currentY = currentY - prevFullRadius - dynamicGap - pointFullRadius;
          }
          
          positions.push({
            opportunity: opp,
            x,
            y: currentY,
            slotIndex: parseInt(slotKey),
            indexInSlot: index,
            totalInSlot: slotCount
          });
        });
      }
    });
    
    return positions;
  }, [sortedOpportunities, timeGranularity, dimensions.width, dimensions.height, scale, panOffset, minTime, timeRange, profitRateRange, minProfitRate, maxProfitRate]);

  // 计算时间刻度
  const calculateTimeTicks = () => {
    if (timeRange === 0) return [];
    
    const timeRangeMs = timeRange;
    const timeRangeHours = timeRangeMs / (1000 * 60 * 60);
    const timeRangeDays = timeRangeMs / (1000 * 60 * 60 * 24);
    
    let tickCount = Math.min(10, Math.max(5, sortedOpportunities.length));
    let formatFunc = formatDateTimeShort;
    
    if (timeRangeDays > 7) {
      tickCount = Math.min(10, Math.max(5, Math.ceil(timeRangeDays)));
      formatFunc = (timestamp) => {
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        return date.toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit'
        });
      };
    } else if (timeRangeHours > 24) {
      tickCount = Math.min(10, Math.max(5, Math.ceil(timeRangeHours / 6)));
      formatFunc = (timestamp) => {
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        return date.toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit'
        });
      };
    } else if (timeRangeHours > 1) {
      tickCount = Math.min(12, Math.max(5, Math.ceil(timeRangeHours)));
      formatFunc = (timestamp) => {
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        return date.toLocaleString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit'
        });
      };
    } else {
      const timeRangeMinutes = timeRangeMs / (1000 * 60);
      tickCount = Math.min(10, Math.max(5, Math.ceil(timeRangeMinutes / 5)));
      formatFunc = (timestamp) => {
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        return date.toLocaleString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      };
    }
    
    const ticks = [];
    for (let i = 0; i < tickCount; i++) {
      const ratio = i / (tickCount - 1);
      const time = new Date(minTime.getTime() + timeRange * ratio);
      ticks.push({
        time,
        ratio,
        label: formatFunc(time)
      });
    }
    
    return ticks;
  };
  
  const timeTicks = calculateTimeTicks();

  // 处理鼠标滚轮缩放（以最右边的可见点为基准）
  const handleWheel = (e) => {
    // 只有当鼠标在时间轴区域内时才处理缩放
    if (!isHoveringTimeline) {
      return;
    }
    
    // 阻止默认滚动行为和事件冒泡，只缩放时间轴
    e.preventDefault();
    e.stopPropagation();
    
    if (sortedOpportunities.length === 0) return;
    
    const padding = 60;
    const chartWidth = dimensions.width - padding * 2;
    const rightEdge = dimensions.width - 20; // 可见区域右边界
    
    // 找到当前可见区域最右边的点
    let rightmostVisiblePoint = null;
    let rightmostX = -Infinity;
    
    sortedOpportunities.forEach(opp => {
      const x = getX(opp.timestamp);
      // 检查点是否在可见区域内（考虑一些边距）
      if (x >= padding - 50 && x <= rightEdge + 50) {
        if (x > rightmostX) {
          rightmostX = x;
          rightmostVisiblePoint = opp;
        }
      }
    });
    
    // 如果没有找到可见点，使用最后一个点
    const referencePoint = rightmostVisiblePoint || sortedOpportunities[sortedOpportunities.length - 1];
    const referenceX = getX(referencePoint.timestamp);
    
    // 计算参考点对应的时间
    const referenceRatio = (referencePoint.timestamp.getTime() - minTime.getTime()) / timeRange;
    
    // 计算新的缩放比例
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(10, scale * zoomFactor));
    
    // 计算新的平移偏移，使参考点保持在原来的位置
    // referenceX = padding + chartWidth * referenceRatio * scale + panOffset
    // 缩放后：referenceX = padding + chartWidth * referenceRatio * newScale + newPanOffset
    // 所以：newPanOffset = referenceX - padding - chartWidth * referenceRatio * newScale
    const newPanOffset = referenceX - padding - chartWidth * referenceRatio * newScale;
    
    setScale(newScale);
    setPanOffset(newPanOffset);
  };

  // 使用原生事件监听器确保可以阻止默认行为
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const wheelHandler = (e) => {
      if (!isHoveringTimeline) {
        return;
      }
      // 使用 passive: false 允许 preventDefault
      e.preventDefault();
      e.stopPropagation();
      
      // 直接在这里处理缩放逻辑，避免依赖问题
      if (sortedOpportunities.length === 0) return;
      
      const padding = 60;
      const chartWidth = dimensions.width - padding * 2;
      const rightEdge = dimensions.width - 20;
      
      let rightmostVisiblePoint = null;
      let rightmostX = -Infinity;
      
      sortedOpportunities.forEach(opp => {
        const x = getX(opp.timestamp);
        if (x >= padding - 50 && x <= rightEdge + 50) {
          if (x > rightmostX) {
            rightmostX = x;
            rightmostVisiblePoint = opp;
          }
        }
      });
      
      const referencePoint = rightmostVisiblePoint || sortedOpportunities[sortedOpportunities.length - 1];
      const referenceX = getX(referencePoint.timestamp);
      const referenceRatio = (referencePoint.timestamp.getTime() - minTime.getTime()) / timeRange;
      
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(10, scale * zoomFactor));
      const newPanOffset = referenceX - padding - chartWidth * referenceRatio * newScale;
      
      setScale(newScale);
      setPanOffset(newPanOffset);
    };

    // 在捕获阶段监听，使用 passive: false 确保可以阻止默认行为
    container.addEventListener('wheel', wheelHandler, { passive: false, capture: true });
    
    return () => {
      container.removeEventListener('wheel', wheelHandler, { passive: false, capture: true });
    };
  }, [isHoveringTimeline, sortedOpportunities, dimensions.width, scale, panOffset, minTime, timeRange]);

  // 处理拖拽开始
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // 只处理左键
    // 如果点击的是套利点，不触发拖拽
    if (e.target.tagName === 'circle' || e.target.closest('g[data-opportunity]')) {
      return;
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX, offset: panOffset });
    e.preventDefault();
  };

  // 重置缩放和平移
  const handleReset = () => {
    setScale(1);
    setPanOffset(0);
  };

  // 早期返回检查必须在所有 Hooks 之后
  if (opportunities.length === 0 || sortedOpportunities.length === 0) {
    return <div className="timeline-empty">暂无数据</div>;
  }

  return (
    <div 
      className="timeline-wrapper" 
      ref={containerRef}
      onMouseEnter={() => setIsHoveringTimeline(true)}
      onMouseLeave={() => setIsHoveringTimeline(false)}
    >
      <div className="timeline-controls" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '10px',
        padding: '0 10px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ fontSize: '12px', color: '#6b7280' }}>
          滚轮缩放 | 拖拽平移
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px' }}>
            时间粒度:
            <select
              value={timeGranularity}
              onChange={(e) => setTimeGranularity(Number(e.target.value))}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                backgroundColor: 'white',
                color: '#374151',
                cursor: 'pointer'
              }}
            >
              <option value={5}>5分钟</option>
              <option value={15}>15分钟</option>
              <option value={30}>30分钟</option>
              <option value={60}>1小时</option>
              <option value={120}>2小时</option>
              <option value={240}>4小时</option>
              <option value={360}>6小时</option>
              <option value={720}>12小时</option>
              <option value={1440}>24小时</option>
            </select>
          </label>
          <button
            onClick={handleReset}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#4f46e5'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#6366f1'}
          >
            重置视图
          </button>
        </div>
      </div>
      <div 
        className="timeline-container-inner" 
        style={{ 
          width: '100%', 
          overflow: 'hidden',
          padding: '20px 0'
        }}
        onMouseEnter={() => setIsHoveringTimeline(true)}
        onMouseLeave={() => setIsHoveringTimeline(false)}
      >
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="timeline-svg"
          style={{ 
            minWidth: `${dimensions.width}px`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          onMouseDown={handleMouseDown}
          onMouseEnter={() => setIsHoveringTimeline(true)}
          onMouseLeave={() => setIsHoveringTimeline(false)}
        >
          {/* ETH价格趋势曲线 */}
          {priceCurvePoints.length > 0 && (() => {
            // 构建路径字符串
            const pathData = priceCurvePoints
              .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
              .join(' ');
            
            // 计算价格区域
            const priceAreaTop = 20;
            const priceAreaHeight = (dimensions.height - 40 - priceAreaTop) * 0.8;
            const priceAreaBottom = priceAreaTop + priceAreaHeight;
            
            return (
              <g>
                {/* 价格曲线 */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.8"
                />
                {/* 价格曲线填充区域（渐变） */}
                <defs>
                  <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={`${pathData} L ${priceCurvePoints[priceCurvePoints.length - 1].x} ${priceAreaBottom} L ${priceCurvePoints[0].x} ${priceAreaBottom} Z`}
                  fill="url(#priceGradient)"
                />
                {/* 价格Y轴标签（右侧） */}
                {priceRange && (() => {
                  const ticks = [];
                  for (let i = 0; i <= 4; i++) {
                    const price = priceRange.min + (priceRange.range * i) / 4;
                    const priceRatio = (price - priceRange.min) / priceRange.range;
                    const y = priceAreaBottom - priceRatio * priceAreaHeight;
                    ticks.push({ price, y });
                  }
                  return ticks.map((tick, index) => (
                    <g key={`price-tick-${index}`}>
                      <line
                        x1={dimensions.width - 60}
                        y1={tick.y}
                        x2={dimensions.width - 50}
                        y2={tick.y}
                        stroke="#8b5cf6"
                        strokeWidth="1"
                        opacity="0.5"
                      />
                      <text
                        x={dimensions.width - 45}
                        y={tick.y + 4}
                        fill="#8b5cf6"
                        fontSize="10"
                        fontWeight="500"
                      >
                        ${tick.price.toFixed(0)}
                      </text>
                    </g>
                  ));
                })()}
              </g>
            );
          })()}

          {/* 时间轴基线 */}
          <line
            x1={getX(minTime)}
            y1={dimensions.height - 40}
            x2={getX(maxTime)}
            y2={dimensions.height - 40}
            stroke="#374151"
            strokeWidth="2"
          />

          {/* 绘制套利机会点 */}
          {getOpportunityPositions.map((pos, index) => {
            const { opportunity: opp, x, y } = pos;
            const style = getOpportunityStyle(opp.profit_rate);
            const isHovered = hoveredOpportunity && hoveredOpportunity.id === opp.id;
            const baselineY = dimensions.height - 40;
            
            return (
              <g
                key={opp.id || index}
                data-opportunity="true"
                onMouseEnter={(e) => {
                  if (isDragging) return;
                  const svgElement = e.currentTarget.closest('svg');
                  const svgRect = svgElement?.getBoundingClientRect();
                  const containerRect = containerRef.current?.getBoundingClientRect();
                  
                  if (containerRect && svgRect) {
                    // 使用数据点的X坐标，鼠标的Y坐标
                    const pointX = svgRect.left + x - containerRect.left;
                    const mouseY = e.clientY - containerRect.top;
                    onHover(opp, { x: pointX, y: mouseY });
                  } else if (containerRect) {
                    const relativeX = e.clientX - containerRect.left;
                    const relativeY = e.clientY - containerRect.top;
                    onHover(opp, { x: relativeX, y: relativeY });
                  } else {
                    onHover(opp, { x: e.clientX, y: e.clientY });
                  }
                }}
                onMouseMove={(e) => {
                  if (isDragging) return;
                  const svgElement = e.currentTarget.closest('svg');
                  const svgRect = svgElement?.getBoundingClientRect();
                  const containerRect = containerRef.current?.getBoundingClientRect();
                  
                  if (containerRect && svgRect) {
                    // 使用数据点的X坐标，鼠标的Y坐标
                    const pointX = svgRect.left + x - containerRect.left;
                    const mouseY = e.clientY - containerRect.top;
                    onHover(opp, { x: pointX, y: mouseY });
                  } else if (containerRect) {
                    const relativeX = e.clientX - containerRect.left;
                    const relativeY = e.clientY - containerRect.top;
                    onHover(opp, { x: relativeX, y: relativeY });
                  }
                }}
                onMouseLeave={() => {
                  if (!isDragging) {
                    onHover(null, null);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* 连接线（从基线到点，如果点不在基线上） */}
                {y !== baselineY && (
                  <line
                    x1={x}
                    y1={baselineY}
                    x2={x}
                    y2={y}
                    stroke={style.color}
                    strokeWidth="1.5"
                    opacity="0.4"
                  />
                )}
                {/* 标记点 */}
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? style.size + 3 : style.size}
                  fill={style.color}
                  stroke="white"
                  strokeWidth={isHovered ? 3 : 2}
                  opacity={isHovered ? 1 : 0.8}
                  style={{ 
                    transition: 'r 0.2s, opacity 0.2s',
                    filter: isHovered ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' : 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))'
                  }}
                />
              </g>
            );
          })}

          {/* 时间刻度 */}
          {timeTicks.map((tick, index) => {
            const x = getX(tick.time);
            if (x < 60 || x > dimensions.width - 20) return null;
            const timelineY = dimensions.height - 40;
            return (
              <g key={`time-tick-${index}`}>
                <line
                  x1={x}
                  y1={timelineY - 5}
                  x2={x}
                  y2={timelineY + 5}
                  stroke="#6b7280"
                  strokeWidth="1.5"
                />
                <text
                  x={x}
                  y={dimensions.height - 20}
                  textAnchor="middle"
                  fill="#6b7280"
                  fontSize="11"
                  fontWeight="500"
                >
                  {tick.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 图例 */}
      <div className="timeline-legend">
        {(() => {
          // 根据实际数据计算利润率阈值
          let threshold1, threshold2, threshold3;
          if (profitRateRange === 0) {
            // 如果所有利润率相同，显示单一值
            threshold1 = threshold2 = threshold3 = minProfitRate;
          } else {
            threshold1 = minProfitRate + profitRateRange * 0.3;
            threshold2 = minProfitRate + profitRateRange * 0.6;
            threshold3 = minProfitRate + profitRateRange * 0.8;
          }
          
          // 格式化函数，根据数值大小选择合适的精度
          const formatThreshold = (value) => {
            if (value < 0.1) {
              return value.toFixed(3); // 小于0.1%时显示3位小数
            } else if (value < 1) {
              return value.toFixed(2); // 小于1%时显示2位小数
            } else {
              return value.toFixed(1); // 大于等于1%时显示1位小数
            }
          };
          
          return (
            <>
              {priceCurvePoints.length > 0 && (
                <div className="legend-item">
                  <div style={{ 
                    width: '24px', 
                    height: '2px', 
                    background: '#8b5cf6',
                    borderRadius: '1px'
                  }}></div>
                  <span>ETH价格趋势</span>
                </div>
              )}
              <div className="legend-item">
                <div className="legend-dot" style={{ background: '#6366f1', width: '12px', height: '12px', borderRadius: '50%' }}></div>
                <span>低利润率 (&lt;{formatThreshold(threshold1)}%)</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: '#10b981', width: '12px', height: '12px', borderRadius: '50%' }}></div>
                <span>中等利润率 ({formatThreshold(threshold1)}-{formatThreshold(threshold2)}%)</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: '#f59e0b', width: '12px', height: '12px', borderRadius: '50%' }}></div>
                <span>较高利润率 ({formatThreshold(threshold2)}-{formatThreshold(threshold3)}%)</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: '#ef4444', width: '12px', height: '12px', borderRadius: '50%' }}></div>
                <span>高利润率 (&gt;{formatThreshold(threshold3)}%)</span>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

// 数据分析组件
function OpportunityDataAnalysis({ opportunities }) {
  const [hoveredBin, setHoveredBin] = React.useState(null);
  const [hoveredHour, setHoveredHour] = React.useState(null);
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });
  const profitChartRef = React.useRef(null);
  const timeChartRef = React.useRef(null);
  
  // 计算统计数据
  const stats = React.useMemo(() => {
    if (opportunities.length === 0) {
      return {
        total: 0,
        maxProfit: 0,
        minProfit: 0,
        totalProfit: 0,
        avgPriceDiff: 0,
        maxPriceDiff: 0,
        minPriceDiff: 0
      };
    }

    const profits = opportunities.map(o => o.profit || 0);
    const priceDiffs = opportunities.map(o => o.price_diff_percent || 0);

    return {
      total: opportunities.length,
      maxProfit: Math.max(...profits),
      minProfit: Math.min(...profits),
      totalProfit: profits.reduce((a, b) => a + b, 0),
      avgPriceDiff: priceDiffs.reduce((a, b) => a + b, 0) / priceDiffs.length,
      maxPriceDiff: Math.max(...priceDiffs),
      minPriceDiff: Math.min(...priceDiffs)
    };
  }, [opportunities]);

  // 计算利润率分布（用于直方图）
  const profitRateDistribution = React.useMemo(() => {
    if (opportunities.length === 0) return [];
    
    // 注意：后端API已经返回百分比形式（已乘以100），所以这里不需要再乘以100
    const profitRates = opportunities.map(o => o.profit_rate || 0);
    const min = Math.min(...profitRates);
    const max = Math.max(...profitRates);
    const bins = 10;
    const binSize = (max - min) / bins || 1;
    
    const distribution = Array(bins).fill(0).map((_, i) => ({
      range: `${(min + i * binSize).toFixed(1)}% - ${(min + (i + 1) * binSize).toFixed(1)}%`,
      count: 0,
      min: min + i * binSize,
      max: min + (i + 1) * binSize,
      opportunities: [] // 存储该区间内的所有机会
    }));
    
    opportunities.forEach(opp => {
      const rate = opp.profit_rate || 0;
      const binIndex = Math.min(
        Math.floor((rate - min) / binSize),
        bins - 1
      );
      if (binIndex >= 0 && binIndex < bins) {
        distribution[binIndex].count++;
        distribution[binIndex].opportunities.push(opp);
      }
    });
    
    // 计算每个区间的统计信息
    return distribution.map(bin => {
      if (bin.count === 0) {
        return {
          ...bin,
          avgProfitRate: 0,
          totalProfit: 0,
          avgProfit: 0,
          avgPriceDiff: 0,
          maxProfit: 0,
          minProfit: 0
        };
      }
      
      const profits = bin.opportunities.map(o => o.profit || 0);
      const rates = bin.opportunities.map(o => o.profit_rate || 0);
      const priceDiffs = bin.opportunities.map(o => o.price_diff_percent || 0);
      
      return {
        ...bin,
        avgProfitRate: rates.reduce((a, b) => a + b, 0) / rates.length,
        totalProfit: profits.reduce((a, b) => a + b, 0),
        avgProfit: profits.reduce((a, b) => a + b, 0) / profits.length,
        avgPriceDiff: priceDiffs.reduce((a, b) => a + b, 0) / priceDiffs.length,
        maxProfit: Math.max(...profits),
        minProfit: Math.min(...profits)
      };
    });
  }, [opportunities]);

  // 计算时间分布（按小时）
  const timeDistribution = React.useMemo(() => {
    if (opportunities.length === 0) return [];
    
    const hourData = {};
    opportunities.forEach(opp => {
      if (opp.timestamp) {
        const date = new Date(opp.timestamp);
        const hour = date.getHours();
        if (!hourData[hour]) {
          hourData[hour] = [];
        }
        hourData[hour].push(opp);
      }
    });
    
    return Array.from({ length: 24 }, (_, hour) => {
      const opps = hourData[hour] || [];
      const count = opps.length;
      
      if (count === 0) {
        return {
          hour,
          count: 0,
          label: `${hour}:00`,
          avgProfitRate: 0,
          totalProfit: 0,
          avgProfit: 0,
          avgPriceDiff: 0,
          maxProfit: 0,
          minProfit: 0
        };
      }
      
      const profits = opps.map(o => o.profit || 0);
      const rates = opps.map(o => o.profit_rate || 0);
      const priceDiffs = opps.map(o => o.price_diff_percent || 0);
      
      return {
        hour,
        count,
        label: `${hour}:00`,
        avgProfitRate: rates.reduce((a, b) => a + b, 0) / rates.length,
        totalProfit: profits.reduce((a, b) => a + b, 0),
        avgProfit: profits.reduce((a, b) => a + b, 0) / profits.length,
        avgPriceDiff: priceDiffs.reduce((a, b) => a + b, 0) / priceDiffs.length,
        maxProfit: Math.max(...profits),
        minProfit: Math.min(...profits)
      };
    });
  }, [opportunities]);

  const maxDistributionCount = Math.max(...profitRateDistribution.map(d => d.count), 1);
  const maxTimeCount = Math.max(...timeDistribution.map(d => d.count), 1);

  return (
    <div className="data-analysis-panel">
      <h3 className="analysis-panel-title">数据分析</h3>
      
      {/* 统计摘要卡片 */}
      <div className="stats-summary">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-label">机会总数</div>
            <div className="stat-value">{stats.total}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-label">总潜在利润</div>
            <div className="stat-value">{formatNumber(stats.totalProfit, 2)} USDT</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⬆️</div>
          <div className="stat-content">
            <div className="stat-label">最大利润</div>
            <div className="stat-value">{formatNumber(stats.maxProfit, 2)} USDT</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⬇️</div>
          <div className="stat-content">
            <div className="stat-label">最小利润</div>
            <div className="stat-value">{formatNumber(stats.minProfit, 2)} USDT</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💹</div>
          <div className="stat-content">
            <div className="stat-label">平均价格差</div>
            <div className="stat-value">{formatNumber(stats.avgPriceDiff, 2)}%</div>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="charts-grid">
        {/* 利润率分布直方图 */}
        <div className="chart-container" ref={profitChartRef}>
          <h4 className="chart-title">利润率分布</h4>
          <div className="histogram-chart">
            {profitRateDistribution.map((bin, index) => (
              <div 
                key={index} 
                className="histogram-bar-container"
                onMouseEnter={(e) => {
                  if (bin.count > 0) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const containerRect = profitChartRef.current?.getBoundingClientRect();
                    if (containerRect) {
                      setTooltipPos({
                        x: e.clientX - containerRect.left,
                        y: e.clientY - containerRect.top
                      });
                    }
                    setHoveredBin(bin);
                  }
                }}
                onMouseLeave={() => setHoveredBin(null)}
                onMouseMove={(e) => {
                  if (bin.count > 0 && hoveredBin) {
                    const containerRect = profitChartRef.current?.getBoundingClientRect();
                    if (containerRect) {
                      setTooltipPos({
                        x: e.clientX - containerRect.left,
                        y: e.clientY - containerRect.top
                      });
                    }
                  }
                }}
              >
                <div 
                  className="histogram-bar"
                  style={{
                    height: `${(bin.count / maxDistributionCount) * 100}%`,
                    backgroundColor: bin.count > 0 
                      ? `hsl(${200 + (bin.count / maxDistributionCount) * 60}, 70%, 50%)`
                      : '#e2e8f0'
                  }}
                >
                  {bin.count > 0 && (
                    <span className="histogram-count">{bin.count}</span>
                  )}
                </div>
                <div className="histogram-label">
                  {index % 2 === 0 ? bin.range.split(' - ')[0] : ''}
                </div>
              </div>
            ))}
          </div>
          {hoveredBin && hoveredBin.count > 0 && (
            <div 
              className="chart-tooltip"
              style={{
                left: tooltipPos.x > (profitChartRef.current?.clientWidth || 400) / 2 
                  ? `${tooltipPos.x - 180}px` 
                  : `${tooltipPos.x + 20}px`,
                top: `${Math.max(10, tooltipPos.y - 150)}px`
              }}
            >
              <div className="tooltip-date">{hoveredBin.range}</div>
              <div className="tooltip-row">
                <span>机会数量:</span>
                <span className="font-mono">{hoveredBin.count}</span>
              </div>
              <div className="tooltip-row">
                <span>平均利润率:</span>
                <span className="font-mono">{formatNumber(hoveredBin.avgProfitRate, 2)}%</span>
              </div>
              <div className="tooltip-row">
                <span>总利润:</span>
                <span className="font-mono">{formatProfit(hoveredBin.totalProfit)}</span>
              </div>
              <div className="tooltip-row">
                <span>平均利润:</span>
                <span className="font-mono">{formatProfit(hoveredBin.avgProfit)}</span>
              </div>
              <div className="tooltip-row">
                <span>最大利润:</span>
                <span className="font-mono">{formatProfit(hoveredBin.maxProfit)}</span>
              </div>
              <div className="tooltip-row">
                <span>最小利润:</span>
                <span className="font-mono">{formatProfit(hoveredBin.minProfit)}</span>
              </div>
              <div className="tooltip-row">
                <span>平均价格差:</span>
                <span className="font-mono">{formatNumber(hoveredBin.avgPriceDiff, 2)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* 时间分布柱状图 */}
        <div className="chart-container" ref={timeChartRef}>
          <h4 className="chart-title">按小时分布</h4>
          <div className="time-distribution-chart">
            {timeDistribution.map((item, index) => (
              <div 
                key={index} 
                className="time-bar-container"
                onMouseEnter={(e) => {
                  if (item.count > 0) {
                    const containerRect = timeChartRef.current?.getBoundingClientRect();
                    if (containerRect) {
                      setTooltipPos({
                        x: e.clientX - containerRect.left,
                        y: e.clientY - containerRect.top
                      });
                    }
                    setHoveredHour(item);
                  }
                }}
                onMouseLeave={() => setHoveredHour(null)}
                onMouseMove={(e) => {
                  if (item.count > 0 && hoveredHour) {
                    const containerRect = timeChartRef.current?.getBoundingClientRect();
                    if (containerRect) {
                      setTooltipPos({
                        x: e.clientX - containerRect.left,
                        y: e.clientY - containerRect.top
                      });
                    }
                  }
                }}
              >
                <div 
                  className="time-bar"
                  style={{
                    height: `${(item.count / maxTimeCount) * 100}%`,
                    backgroundColor: item.count > 0
                      ? `hsl(${220 + (item.count / maxTimeCount) * 40}, 70%, 50%)`
                      : '#e2e8f0'
                  }}
                >
                  {item.count > 0 && (
                    <span className="time-count">{item.count}</span>
                  )}
                </div>
                <div className="time-label">{item.hour}</div>
              </div>
            ))}
          </div>
          {hoveredHour && hoveredHour.count > 0 && (
            <div 
              className="chart-tooltip"
              style={{
                left: tooltipPos.x > (timeChartRef.current?.clientWidth || 400) / 2 
                  ? `${tooltipPos.x - 180}px` 
                  : `${tooltipPos.x + 20}px`,
                top: `${Math.max(10, tooltipPos.y - 150)}px`
              }}
            >
              <div className="tooltip-date">{hoveredHour.label}</div>
              <div className="tooltip-row">
                <span>机会数量:</span>
                <span className="font-mono">{hoveredHour.count}</span>
              </div>
              <div className="tooltip-row">
                <span>平均利润率:</span>
                <span className="font-mono">{formatNumber(hoveredHour.avgProfitRate, 2)}%</span>
              </div>
              <div className="tooltip-row">
                <span>总利润:</span>
                <span className="font-mono">{formatProfit(hoveredHour.totalProfit)}</span>
              </div>
              <div className="tooltip-row">
                <span>平均利润:</span>
                <span className="font-mono">{formatProfit(hoveredHour.avgProfit)}</span>
              </div>
              <div className="tooltip-row">
                <span>最大利润:</span>
                <span className="font-mono">{formatProfit(hoveredHour.maxProfit)}</span>
              </div>
              <div className="tooltip-row">
                <span>最小利润:</span>
                <span className="font-mono">{formatProfit(hoveredHour.minProfit)}</span>
              </div>
              <div className="tooltip-row">
                <span>平均价格差:</span>
                <span className="font-mono">{formatNumber(hoveredHour.avgPriceDiff, 2)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ArbitrageAnalysis;

