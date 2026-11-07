import requests
import json
import time

print('=== First Call (Cache Miss) ===')
start = time.time()
r1 = requests.get('http://127.0.0.1:8000/market/top-movers')
elapsed1 = time.time() - start
print(f'Status: {r1.status_code}')
print(f'Time: {elapsed1:.2f}s')
data1 = r1.json()
print(f'Stocks analyzed: {data1.get("total_stocks_analyzed", "N/A")}')
print(f'Cached: {data1.get("cached", False)}')
print(f'Gainers: {len(data1.get("gainers", []))}')

print()
print('=== Second Call (Cache Hit) ===')
start = time.time()
r2 = requests.get('http://127.0.0.1:8000/market/top-movers')
elapsed2 = time.time() - start
print(f'Status: {r2.status_code}')
print(f'Time: {elapsed2:.4f}s')
data2 = r2.json()
print(f'Cached: {data2.get("cached", False)}')
print(f'Cache age: {data2.get("cache_age_seconds", "N/A")} seconds')

print()
print(f'Performance Improvement: {elapsed1:.2f}s -> {elapsed2:.4f}s ({int(elapsed1/elapsed2)}x faster)')
print()
print('=== Sample Gainer ===')
if data1.get('gainers'):
    print(json.dumps(data1['gainers'][0], indent=2))
print()
print('=== Sample Loser ===')
if data1.get('losers'):
    print(json.dumps(data1['losers'][-1], indent=2))
