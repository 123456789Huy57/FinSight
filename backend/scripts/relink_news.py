"""Remove stale ticker links for every stored article (idempotent).

Default is a dry run that only reports what would change:
    python -m scripts.relink_news
Apply removals (does not add newly inferred links):
    python -m scripts.relink_news --apply
Re-running after --apply reports 0 changes.

This command deliberately does not add links. Reconstructing historical links
from a changed matcher can create false positives; new links are created only
when a fresh article is ingested.
"""

import argparse
import asyncio

from sqlalchemy import delete, select

from db.models import NewsArticle, NewsEventStudy, NewsSymbol, Symbol
from db.session import AsyncSessionLocal
from domain.ticker_linking import related_symbols


async def relink(apply: bool) -> dict[str, int]:
    removed = studies = touched = 0
    async with AsyncSessionLocal() as session:
        listed = list((await session.execute(
            select(Symbol.symbol, Symbol.name).where(Symbol.is_active.is_(True))
        )).all())
        pairs = [(code, name) for code, name in listed]
        valid = {code for code, _ in listed}
        articles = (await session.execute(
            select(NewsArticle.id, NewsArticle.title, NewsArticle.summary)
        )).all()
        for article_id, title, summary in articles:
            wanted = set(related_symbols(f"{title} {summary or ''}", pairs)) & valid
            current = set((await session.scalars(
                select(NewsSymbol.symbol).where(NewsSymbol.article_id == article_id)
            )).all())
            stale = current - wanted
            if not stale:
                continue
            touched += 1
            for code in sorted(stale):
                print(f"REMOVE {article_id} {code} | {title[:80]}")
            removed += len(stale)
            if stale:
                studies += len((await session.scalars(select(NewsEventStudy.article_id).where(
                    NewsEventStudy.article_id == article_id, NewsEventStudy.symbol.in_(stale)
                ))).all())
            if apply:
                if stale:
                    await session.execute(delete(NewsEventStudy).where(
                        NewsEventStudy.article_id == article_id, NewsEventStudy.symbol.in_(stale)))
                    await session.execute(delete(NewsSymbol).where(
                        NewsSymbol.article_id == article_id, NewsSymbol.symbol.in_(stale)))
        if apply:
            await session.commit()
    result = {"articles": len(articles), "articlesChanged": touched, "linksRemoved": removed,
              "linksAdded": 0, "eventStudiesRemoved": studies, "applied": int(apply)}
    print(result)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    asyncio.run(relink(parser.parse_args().apply))
