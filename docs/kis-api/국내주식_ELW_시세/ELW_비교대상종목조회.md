# ELW 비교대상종목조회

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-183` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/quotations/compare-stocks`
- TR_ID: 실전 `FHKEW151701C0` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW 비교대상종목조회 API입니다.
한국투자 HTS(eFriend Plus) > [0288] ELW 기초자산별 ELW 시세의 좌측 화면 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHKEW151701C0 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_SCR_DIV_CODE | 조건화면분류코드 | string | Y | 5 | 11517(Primary key) |
| FID_INPUT_ISCD | 입력종목코드 | string | Y | 12 | 종목코드(ex)005930(삼성전자)) |

## Response Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | 요청한 tr_id |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Response Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| rt_cd | 성공 실패 여부 | string | Y | 1 |  |
| msg_cd | 응답코드 | string | Y | 8 |  |
| msg1 | 응답메세지 | string | Y | 80 |  |
| **output** | 응답상세 | object | Y |  |  |
| elw_shrn_iscd | ELW단축종목코드 | string | Y | 9 |  |
| elw_kor_isnm | ELW한글종목명 | string | Y | 40 |  |

## Request Example (Python)

```text
FID_COND_SCR_DIV_CODE:11517
FID_INPUT_ISCD:005930
```

## Response Example

```json
{
    "output": [
        {
            "elw_shrn_iscd": "58J782",
            "elw_kor_isnm": "KBJ782삼성전자풋"
        },
        {
            "elw_shrn_iscd": "58J993",
            "elw_kor_isnm": "KBJ993삼성전자풋"
        },
        {
            "elw_shrn_iscd": "58JC71",
            "elw_kor_isnm": "KBJC71삼성전자콜"
        },
        {
            "elw_shrn_iscd": "58JC72",
            "elw_kor_isnm": "KBJC72삼성전자콜"
        },
        {
            "elw_shrn_iscd": "58JC73",
            "elw_kor_isnm": "KBJC73삼성전자콜"
        },
        {
            "elw_shrn_iscd": "58JC74",
            "elw_kor_isnm": "KBJC74삼성전자콜"
        },
        {
            "elw_shrn_iscd": "58JC75",
            "elw_kor_isnm": "KBJC75삼성전자콜"
        },
        {
            "elw_shrn_iscd": "58JC76",
            "elw_kor_isnm": "KBJC76삼성전자풋"
        },
        {
            "elw_shrn_iscd": "58JE26",
            "elw_kor_isnm": "KBJE26삼성전자콜"
        },
        {
            "elw_shrn_iscd": "58JE27",
            "elw_kor_isnm": "KBJE27삼성전자콜"
        },
        {
            "elw_shrn_iscd": "58JE28",
            "elw_kor_isnm": "KBJE28삼성전자풋"
        },
        {
            "elw_shrn_iscd": "58JE30",
            "elw_kor_isnm": "KBJE30삼성전자풋"
        },
        {
            "elw_shrn_iscd": "58K001",
            "elw_kor_isnm": "KBK001삼성전자콜"
        },
        {
            "elw_shrn_iscd": "58K002",
            "elw_kor_isnm": "KBK002삼성전자콜"
        },
        {
            "elw_shrn_iscd": "58K003",
            "elw_kor_isnm": "KBK003삼성전자콜"
        },
        {
            "elw_shrn_iscd": "58K004",
            "elw_kor_isnm": "KBK004삼성전자콜"
        },
        {
            "elw_shrn_iscd": "58K005",
            "elw_kor_isnm": "KBK005삼성전자풋"
        },
        {
            "elw_shrn_iscd": "58K006",
            "elw_kor_isnm": "KBK006삼성전자풋"
        },
        {
            "elw_shrn_iscd": "58K167",
            "elw_kor_isnm": "KBK167삼성전자콜"
        },
        {
            "elw_shrn_iscd": "58K168",
            "elw_kor_isnm": "KBK168삼성전자풋"
        },
        {
            "elw_shrn_iscd": "58K169",
            "elw_kor_isnm": "KBK169삼성전자풋"
        },
        {
            "elw_shrn_iscd": "58K314",
            "elw_kor_isnm": "KBK314삼성전자풋"
        },
        {
            "elw_shrn_iscd": "58K416",
            "elw_kor_isnm": "KBK416삼성전자콜"
        },
        {
            "elw_shrn_iscd": "58K417",
            "elw_kor_isnm": "KBK417삼성전자콜"
        },
        {
            "elw_shrn_is
... (생략)
```
