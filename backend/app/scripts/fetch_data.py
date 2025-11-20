import os
import sys
import requests
import time
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import ssl
from requests.adapters import HTTPAdapter

# 将项目根目录添加到 sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# --- 设置 ---
# 向上移动两级以加载项目根目录的 .env 文件
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

# --- 数据库配置 ---
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL 环境变量未设置")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- 导入数据库模型 ---
# 确保模型已定义
from app.models import Base, UniswapSwap, BinanceTrade

# --- API 配置 ---
BINANCE_API_URL = "https://api.binance.com/api/v3/klines"
ETHERSCAN_API_URL = os.getenv("ETHERSCAN_API_URL", "https://api.etherscan.io/v2/api")
ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY")
UNISWAP_POOL_ADDRESS = "0x11b815efB8f581194ae79006d24E0d814B7697F6"

# --- 时间范围 ---
START_TIMESTAMP = int(datetime(2025, 9, 1, tzinfo=timezone.utc).timestamp())
END_TIMESTAMP = int(datetime(2025, 9, 30, 23, 59, 59, tzinfo=timezone.utc).timestamp())

# --- 自定义 SSL 适配器 ---
class TLSv12HttpAdapter(HTTPAdapter):
    def init_poolmanager(self, connections, maxsize, block=False):
        ctx = ssl.create_default_context()
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2 # 强制使用 TLSv1.2
        self.poolmanager = requests.packages.urllib3.poolmanager.PoolManager(
            num_pools=connections,
            maxsize=maxsize,
            block=block,
            ssl_context=ctx
        )

# --- 数据获取函数 ---

def fetch_binance_data(db_session):
    """获取并存储币安 USDT/ETH 交易数据"""
    print("正在获取币安数据...")
    symbol = "ETHUSDT"
    interval = "1m"  # 1分钟 K 线
    limit = 1000 # API 单次请求限制

    # 将时间戳转换为毫秒
    startTime = START_TIMESTAMP * 1000
    endTime = END_TIMESTAMP * 1000

    session = requests.Session()
    session.mount("https://", TLSv12HttpAdapter())

    while startTime < endTime:
        params = {
            "symbol": symbol,
            "interval": interval,
            "startTime": startTime,
            "endTime": endTime,
            "limit": limit
        }
        try:
            response = session.get(BINANCE_API_URL, params=params, timeout=30)
            response.raise_for_status()
            klines = response.json()
        except requests.exceptions.RequestException as e:
            print(f"请求币安数据时发生错误: {e}")
            break

        if not klines:
            break

        for kline in klines:
            trade_time = datetime.fromtimestamp(kline[0] / 1000, tz=timezone.utc)
            price = float(kline[4]) # 收盘价
            quantity = float(kline[5]) # 成交量

            # 检查数据是否已存在
            exists = db_session.query(BinanceTrade).filter_by(timestamp=trade_time, price=price).first()
            if not exists:
                trade = BinanceTrade(
                    timestamp=trade_time,
                    price=price,
                    quantity=quantity
                )
                db_session.add(trade)
        
        # 更新下一次请求的开始时间
        startTime = klines[-1][0] + 1
        print(f"已获取并处理至：{datetime.fromtimestamp(startTime / 1000, tz=timezone.utc)}")
        time.sleep(0.5) # 尊重 API 速率限制

    db_session.commit()
    print("币安数据获取完成。")


def get_block_number_by_timestamp(timestamp, closest="before"):
    """使用 Etherscan API 根据时间戳获取区块号"""
    params = {
        "module": "block",
        "action": "getblocknobytime",
        "timestamp": str(timestamp),
        "closest": closest,
        "apikey": ETHERSCAN_API_KEY,
        "chainId": 1
    }
    for _ in range(3):  # 重试3次
        try:
            response = requests.get(ETHERSCAN_API_URL, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            if data.get("status") == "1":
                return int(data["result"])
            else:
                print(f"获取区块号API错误: {data.get('message')} - {data.get('result')}")
        except requests.exceptions.RequestException as e:
            print(f"获取区块号时出错: {e}")
        time.sleep(2)
    return None

def fetch_uniswap_data(db_session):
    """获取并存储 Uniswap V3 Swap 事件数据"""
    print("正在获取 Uniswap 数据...")

    start_block = get_block_number_by_timestamp(START_TIMESTAMP, closest="after")
    end_block = get_block_number_by_timestamp(END_TIMESTAMP, closest="before")

    if not start_block or not end_block:
        print("无法获取起始或结束区块号，正在退出。")
        return

    print(f"将从区块 {start_block} 获取到 {end_block}...")

    current_block = start_block
    block_chunk = 5000  # Etherscan 对区块范围有隐式限制，5000 是一个比较安全的值

    # Swap 事件的 Topic0 哈希
    swap_topic = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"

    while current_block <= end_block:
        chunk_end_block = min(current_block + block_chunk - 1, end_block)
        print(f"正在处理区块范围: {current_block} -> {chunk_end_block}")

        params = {
            "module": "logs",
            "action": "getLogs",
            "address": UNISWAP_POOL_ADDRESS,
            "fromBlock": str(current_block),
            "toBlock": str(chunk_end_block),
            "topic0": swap_topic,
            "apikey": ETHERSCAN_API_KEY,
            "chainId": 1
        }

        try:
            response = requests.get(ETHERSCAN_API_URL, params=params, timeout=30)
            response.raise_for_status()
            response_data = response.json()

            if response_data.get("status") != "1":
                error_message = response_data.get("message", "Unknown error")
                result = response_data.get("result", "")
                print(f"Etherscan API 返回错误: {error_message} - {result}")
                if "rate limit" in error_message.lower():
                    print("达到速率限制，等待5秒...")
                    time.sleep(5)
                else:
                    # 如果不是速率限制，可能是无效的区块范围或其他问题，前进到下一个 chunk
                    current_block += block_chunk
                    time.sleep(1)
                continue

            logs = response_data.get("result", [])

            if not logs:
                print("在此区块范围未找到日志。")
                current_block += block_chunk
                time.sleep(0.2)
                continue

            for log in logs:
                timestamp_val = int(log['timeStamp'], 16)
                timestamp = datetime.fromtimestamp(timestamp_val, tz=timezone.utc)

                # 双重检查时间戳确保在范围内
                if START_TIMESTAMP <= timestamp_val <= END_TIMESTAMP:
                    data = log['data'][2:]
                    if len(data) < 128:
                        print(f"数据字段长度不足: {log['transactionHash']}")
                        continue
                    
                    amount0_hex = data[0:64]
                    amount1_hex = data[64:128]
                    
                    try:
                        amount0_int = int(amount0_hex, 16)
                        amount1_int = int(amount1_hex, 16)
                    except ValueError:
                        print(f"无法解析 amount: data={data} in tx {log['transactionHash']}")
                        continue

                    # 将 uint256 转换为 int256
                    if amount0_int >= 2**255:
                        amount0_int -= 2**256
                    if amount1_int >= 2**255:
                        amount1_int -= 2**256

                    amount0 = amount0_int / 1e6  # USDC is token0 with 6 decimals
                    amount1 = amount1_int / 1e18 # WETH is token1 with 18 decimals
                    
                    # 价格是 USDC/WETH
                    if amount1 != 0:
                        price = abs(amount0 / amount1)
                    else:
                        price = 0
                        
                    tx_hash = log['transactionHash']
                    log_index = int(log['logIndex'], 16) # 使用 logIndex 来唯一标识事件

                    # 使用 tx_hash 和 log_index 确保唯一性
                    exists = db_session.query(UniswapSwap).filter_by(transaction_hash=tx_hash, log_index=log_index).first()
                    if not exists:
                        swap = UniswapSwap(
                            transaction_hash=tx_hash,
                            log_index=log_index,
                            timestamp=timestamp,
                            amount0=amount0,
                            amount1=amount1,
                            price=price
                        )
                        db_session.add(swap)
            
            db_session.commit()
            print(f"已提交 {len(logs)} 条日志的处理结果。")

        except requests.exceptions.RequestException as e:
            print(f"请求 Uniswap 数据时发生错误: {e}")
            db_session.rollback()
            time.sleep(5)
            continue

        current_block += block_chunk
        time.sleep(0.2) # 尊重 API 速率限制

    db_session.commit() # 确保最后一部分数据被提交
    print("Uniswap 数据获取完成。")


def main():
    """主函数，用于执行数据爬取和存储"""
    # 创建表（如果不存在）
    Base.metadata.create_all(bind=engine)
    
    db_session = SessionLocal()
    
    try:
        fetch_uniswap_data(db_session)
        fetch_binance_data(db_session)
    except Exception as e:
        print(f"发生错误: {e}")
        db_session.rollback()
    finally:
        db_session.close()
        print("数据库会话已关闭。")

if __name__ == "__main__":
    main()
