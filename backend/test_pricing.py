import asyncio
import os
import json
from ai_service import extract_scope
from pricing import estimate_hours, price_estimate, project_timeline

# Make sure LLM environment variables are loaded
os.environ["LLM_PROVIDER"] = "gemini"
os.environ["LLM_MODEL"] = "gemini-3-flash-preview"

async def test():
    # Sample "Web Development" brief instead of video
    brief = "Tolong buatkan landing page company profile untuk perusahaan travel. Harus ada form kontak dan halaman galeri foto (sekitar 5 foto). Budget kita maksimal 5 juta. Waktu 2 minggu ya."
    print("Extracting scope...")
    scope = await extract_scope(brief)
    print("Scope:")
    print(json.dumps(scope, indent=2))
    
    print("\nEstimating hours...")
    hours_info = estimate_hours(scope)
    print(f"Total hours: {hours_info['low']} - {hours_info['high']}")
    print("Item breakdown:")
    for item in hours_info['breakdown']:
        print(f"  {item['label']}: {item['low']}h - {item['high']}h")
        
    print("\nPricing estimate...")
    price_info = price_estimate(
        hours_low=hours_info['low'],
        hours_high=hours_info['high'],
        cost_per_hour=100000,
        direct_costs=0,
        buffers=[],
        target_margin=0.2,
        client_budget=scope.get("client_budget")
    )
    print(json.dumps(price_info, indent=2))

    print("\nTimeline...")
    timeline = project_timeline(
        hours_high=hours_info['high'],
        revision_rounds=scope.get("revision_rounds", 0),
        approver_count=scope.get("approver_count", 1)
    )
    print(json.dumps(timeline, indent=2))

if __name__ == "__main__":
    asyncio.run(test())
