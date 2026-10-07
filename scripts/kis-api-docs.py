#!/usr/bin/env python3
"""KIS(한국투자증권) 오픈API 전체문서 xlsx → docs/kis-api/ 마크다운.

사용법:
  python3 scripts/kis-api-docs.py ~/Downloads/한국투자증권_오픈API_전체문서_YYYYMMDD.xlsx

- 'API 목록' 시트로 전체 색인(README.md)을 만들고, API 시트마다 <카테고리>/<API명>.md 를 쓴다.
- 모든 API 공통 요청 헤더(appkey 등)는 README 에 한 번만 적고 개별 문서에서는 뺀다.
- 기존 docs/kis-api/ 는 지우고 다시 만든다.
"""
import html
import re
import shutil
import sys
from collections import OrderedDict
from pathlib import Path
from urllib.parse import unquote

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'kis-api'
SERVER = ROOT / 'server'

COMMON_HEADERS = {
    'content-type', 'authorization', 'appkey', 'appsecret', 'personalseckey', 'custtype',
    'seq_no', 'mac_address', 'phone_number', 'ip_addr', 'gt_uid', 'hashkey',
}
RESPONSE_EXAMPLE_MAX = 2500


def clean(v):
    if v is None:
        return ''
    s = html.unescape(str(v)).replace('\r\n', '\n').replace('\r', '\n')
    return s.strip()


def cell(v):
    """표 셀용 — 줄바꿈은 <br>, 파이프는 이스케이프."""
    return clean(v).replace('|', '\\|').replace('\n', '<br>')


def slug(s):
    s = clean(s)
    s = re.sub(r'[\[\]]', '', s)
    s = re.sub(r'[\\/:*?"<>|]', '-', s)
    s = re.sub(r'\s+', '_', s)
    return s.strip('_-.') or 'unnamed'


def used_tr_ids():
    ids = set()
    for p in SERVER.rglob('*.mjs'):
        ids.update(re.findall(r"\b((?:FH|CT|TT|VT|HH|JT)[A-Z0-9]{6,})\b", p.read_text(encoding='utf-8')))
    return ids


def parse_sheet(ws):
    """시트 → {meta, overview, sections: OrderedDict[name -> rows], examples}"""
    meta, sections, examples = {}, OrderedDict(), OrderedDict()
    overview = ''
    current = None
    mode = 'meta'
    for row in ws.iter_rows(values_only=True):
        row = list(row) + [None] * 8
        a, b = clean(row[0]), row[1]
        if mode == 'meta':
            if a == '개요' and b is not None:
                overview = clean(b)
                continue
            if a == 'Layout':
                mode = 'layout'
                continue
            if a and b is not None:
                meta[a] = clean(b)
            continue
        if mode == 'layout':
            if a == '구분':
                continue
            if a == 'Example':
                mode = 'example'
                continue
            if a:
                current = a
                sections.setdefault(current, [])
            if current is None or not clean(row[1]):
                continue
            sections[current].append([clean(x) for x in row[1:7]])
            continue
        if a:
            examples[a] = clean(b)
    return {'meta': meta, 'overview': overview, 'sections': sections, 'examples': examples}


def field_table(rows, drop_common=False):
    lines = ['| Element | 한글명 | Type | 필수 | 길이 | 설명 |', '|---|---|---|---|---|---|']
    for el, kor, typ, req, ln, desc in rows:
        if drop_common and el.lower() in COMMON_HEADERS:
            continue
        nested = typ in ('object', 'object array', 'array')
        name = f'**{el}**' if nested else el
        lines.append(f'| {name} | {cell(kor)} | {cell(typ)} | {cell(req)} | {cell(ln)} | {cell(desc)} |')
    return '\n'.join(lines) if len(lines) > 2 else ''


def render(api, parsed, used):
    real_tr, mock_tr = api['real_tr'], api['mock_tr']
    out = [f"# {api['name']}", '']
    out.append(f"- 메뉴: {api['menu']}")
    out.append(f"- API ID: `{api['api_id']}` · 통신방식: {api['proto']}")
    out.append(f"- 요청: `{api['method']} {api['url']}`")
    out.append(f"- TR_ID: 실전 `{real_tr or '-'}` · 모의 `{mock_tr or '-'}`")
    out.append(f"- 도메인: 실전 {api['real_domain'] or '-'} · 모의 {api['mock_domain'] or '-'}")
    if real_tr and real_tr in used:
        out.append('- 이 프로젝트에서 사용 중 (`server/` 에서 TR_ID 검색)')
    out.append('')
    if parsed['overview']:
        out += ['## 개요', '', parsed['overview'], '']
    for name, rows in parsed['sections'].items():
        table = field_table(rows, drop_common=name.lower().endswith('header'))
        if table:
            out += [f'## {name}', '', table, '']
    ex = parsed['examples']
    for key, val in ex.items():
        if not val:
            continue
        if 'Response' in key and len(val) > RESPONSE_EXAMPLE_MAX:
            val = val[:RESPONSE_EXAMPLE_MAX] + '\n... (생략)'
        lang = 'json' if val.lstrip().startswith(('{', '[')) else 'text'
        out += [f'## {key}', '', f'```{lang}', val, '```', '']
    return '\n'.join(out).rstrip() + '\n'


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1]).expanduser()
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)

    apis = []
    for i, row in enumerate(wb['API 목록'].iter_rows(values_only=True)):
        if i == 0 or not row or not row[3]:
            continue
        r = [clean(x) for x in row]
        apis.append({
            'no': r[0], 'proto': r[1], 'menu': r[2], 'name': r[3], 'api_id': r[4],
            'real_tr': r[5] if r[5] and '미지원' not in r[5] else '',
            'mock_tr': r[6] if r[6] and '미지원' not in r[6] else '',
            'method': r[7], 'url': r[8], 'real_domain': r[9],
            'mock_domain': r[10] if r[10] and '미지원' not in r[10] else '',
        })

    # 시트 이름엔 '/' 를 못 써서 '_' 로 바뀌어 있다 — 시트명·시트 안 API명 둘 다로 찾는다
    by_name = {}
    for sn in wb.sheetnames[1:]:
        parsed = parse_sheet(wb[sn])
        by_name[sn] = parsed
        if parsed['meta'].get('API 명'):
            by_name.setdefault(parsed['meta']['API 명'], parsed)

    used = used_tr_ids()
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    groups = OrderedDict()
    missing = []
    for api in apis:
        parsed = by_name.get(api['name']) or by_name.get(api['name'].replace('/', '_'))
        if parsed is None:
            missing.append(api['name'])
            parsed = {'meta': {}, 'overview': '', 'sections': {}, 'examples': {}}
        folder = slug(api['menu'])
        rel = Path(folder) / f"{slug(api['name'])}.md"
        (OUT / folder).mkdir(exist_ok=True)
        (OUT / rel).write_text(render(api, parsed, used), encoding='utf-8')
        api['rel'] = rel.as_posix()
        groups.setdefault(api['menu'], []).append(api)

    readme = [
        '# KIS(한국투자증권) 오픈API 레퍼런스',
        '',
        f'원본: `{unquote(src.name)}` · API {len(apis)}개. `scripts/kis-api-docs.py` 로 생성 — 직접 고치지 말고 새 xlsx 로 다시 생성.',
        '',
        '## 찾는 법',
        '',
        '- TR_ID 로: `rg FHPTJ04160001 docs/kis-api`',
        '- 기능으로: 아래 목록에서 API명 검색, 또는 `rg -l "투자자" docs/kis-api`',
        '- ✅ = 이 프로젝트 `server/` 에서 이미 쓰는 TR_ID',
        '',
        '## 공통 사항',
        '',
        '- 모든 REST 요청 헤더: `content-type`, `authorization: Bearer <접근토큰>`, `appkey`, `appsecret`, `tr_id`, `custtype`(P 개인). 개별 문서에서는 생략.',
        '- 연속조회: 응답 헤더 `tr_cont` 가 `M`/`F` 면 다음 요청에 `tr_cont: N` 을 넣어 이어 받는다.',
        '- 시세 시장코드 `FID_COND_MRKT_DIV_CODE`: `J` KRX · `NX` NXT · `UN` 통합 (API 마다 지원 범위 다름 — 개별 문서 확인).',
        '- 모의투자 미지원 API 는 모의 TR_ID 가 `-` 로 표시된다.',
        '',
    ]
    for menu, items in groups.items():
        readme += [f'## {menu}', '', '| API | 실전 TR_ID | 모의 TR_ID | 요청 |', '|---|---|---|---|']
        for a in items:
            mark = ' ✅' if a['real_tr'] and a['real_tr'] in used else ''
            readme.append(
                f"| [{cell(a['name'])}]({a['rel'].replace(' ', '%20')}){mark} | `{a['real_tr'] or '-'}` | "
                f"`{a['mock_tr'] or '-'}` | `{a['method']} {a['url']}` |"
            )
        readme.append('')
    (OUT / 'README.md').write_text('\n'.join(readme), encoding='utf-8')

    print(f'APIs: {len(apis)}, groups: {len(groups)}, used: {len(used)}, missing sheets: {len(missing)}')
    for n in missing:
        print('  missing:', n)


if __name__ == '__main__':
    main()
