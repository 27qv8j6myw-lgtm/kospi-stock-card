# KRX야간선물 실시간체결통보

- 메뉴: [국내선물옵션] 실시간시세
- API ID: `실시간-066` · 통신방식: WEBSOCKET
- 요청: `POST /tryitout/H0MFCNI0`
- TR_ID: 실전 `H0MFCNI0` · 모의 `-`
- 도메인: 실전 ws://ops.koreainvestment.com:21000 · 모의 -

## 개요

[참고자료]

실시간시세(웹소켓) 파이썬 샘플코드는 한국투자증권 Github 참고 부탁드립니다.
https://github.com/koreainvestment/open-trading-api/tree/main/examples_user/domestic_futureoption

실시간시세(웹소켓) API 사용방법에 대한 자세한 설명은 한국투자증권 Wikidocs 참고 부탁드립니다.
https://wikidocs.net/book/7847 (국내주식, 해외주식 내용 참고)

시세조회 가능한 종목코드 목록은 API문서 > 종목정보파일 에서 확인하실 수 있습니다. ( 헤더파일 및 정제코드 참고)

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| approval_key | 웹소켓 접속키 | string | Y | 36 | 실시간 (웹소켓) 접속키 발급 API(/oauth2/Approval)를 사용하여 발급받은 웹소켓 접속키 |
| tr_type | 등록/해제 | string | Y | 1 | 1: 등록, 2:해제 |

## Request Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 2 | H0MFCNI0 |
| tr_key | 구분값 | string | Y | 12 | HTS ID |

## Response Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| CUST_ID | 고객 ID | string | Y | 8 |  |
| ACNT_NO | 계좌번호 | string | Y | 10 |  |
| ODER_NO | 주문번호 | string | Y | 10 |  |
| OODER_NO | 원주문번호 | string | Y | 10 |  |
| SELN_BYOV_CLS | 매도매수구분 | string | Y | 2 |  |
| RCTF_CLS | 정정구분 | string | Y | 1 |  |
| ODER_KIND2 | 주문종류2 | string | Y | 1 |  |
| STCK_SHRN_ISCD | 주식 단축 종목코드 | string | Y | 9 |  |
| CNTG_QTY | 체결 수량 | string | Y | 10 |  |
| CNTG_UNPR | 체결단가 | string | Y | 9 |  |
| STCK_CNTG_HOUR | 주식 체결 시간 | string | Y | 6 |  |
| RFUS_YN | 거부여부 | string | Y | 1 |  |
| CNTG_YN | 체결여부 | string | Y | 1 |  |
| ACPT_YN | 접수여부 | string | Y | 1 |  |
| BRNC_NO | 지점번호 | string | Y | 5 |  |
| ODER_QTY | 주문수량 | string | Y | 9 |  |
| ACNT_NAME | 계좌명 | string | Y | 12 |  |
| CNTG_ISNM | 체결종목명 | string | Y | 14 |  |
| ODER_COND | 주문조건 | string | Y | 1 |  |
