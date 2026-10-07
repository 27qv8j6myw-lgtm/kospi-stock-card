# ELW 변동성 추이(분별)

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-179` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/quotations/volatility-trend-minute`
- TR_ID: 실전 `FHPEW02840300` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW 변동성 추이(분별) API입니다. 
한국투자 HTS(eFriend Plus) > [0284] ELW 변동성 추이 화면의 "분별" 변동성 추이 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPEW02840300 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건시장분류코드 | string | Y | 2 | W(Unique key) |
| FID_INPUT_ISCD | 입력종목코드 | string | Y | 12 | ex) 58J297(KBJ297삼성전자콜) |
| FID_HOUR_CLS_CODE | 시간구분코드 | string | Y | 5 | '60(1분), 180(3분), 300(5분), 600(10분), 1800(30분), 3600(60분)<br>' |
| FID_PW_DATA_INCU_YN | 과거데이터 포함 여부 | string | Y | 2 | N(과거데이터포함X),Y(과거데이터포함O) |

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
| **output** | 응답상세 | object array | Y |  | array |
| stck_bsop_date | 주식 영업 일자 | string | Y | 6 |  |
| stck_cntg_hour | 주식 체결 시간 | string | Y | 10 |  |
| stck_prpr | 주식 현재가 | string | Y | 10 |  |
| elw_oprc | ELW 시가2 | string | Y | 1 |  |
| elw_hgpr | ELW 최고가 | string | Y | 82 |  |
| elw_lwpr | ELW 최저가 | string | Y | 10 |  |
| hts_ints_vltl | HTS 내재 변동성 | string | Y | 10 |  |
| hist_vltl | 역사적 변동성 | string | Y | 18 |  |

## Request Example (Python)

```text
FID_COND_MRKT_DIV_CODE:W
FID_INPUT_ISCD:57JS61
FID_HOUR_CLS_CODE:60
FID_PW_DATA_INCU_YN:N
```

## Response Example

```json
{
    "output": [
        {
            "stck_bsop_date": "20240422",
            "stck_cntg_hour": "142800",
            "stck_prpr": "265",
            "elw_oprc": "265",
            "elw_hgpr": "265",
            "elw_lwpr": "265",
            "hts_ints_vltl": "21.90",
            "hist_vltl": ""
        },
        {
            "stck_bsop_date": "20240422",
            "stck_cntg_hour": "142700",
            "stck_prpr": "265",
            "elw_oprc": "270",
            "elw_hgpr": "270",
            "elw_lwpr": "260",
            "hts_ints_vltl": "21.90",
            "hist_vltl": ""
        },
        {
            "stck_bsop_date": "20240422",
            "stck_cntg_hour": "142600",
            "stck_prpr": "275",
            "elw_oprc": "275",
            "elw_hgpr": "275",
            "elw_lwpr": "275",
            "hts_ints_vltl": "22.06",
            "hist_vltl": ""
        },
        {
            "stck_bsop_date": "20240422",
            "stck_cntg_hour": "142500",
            "stck_prpr": "270",
            "elw_oprc": "275",
            "elw_hgpr": "275",
            "elw_lwpr": "270",
            "hts_ints_vltl": "22.06",
            "hist_vltl": ""
        },
		...
        {
            "stck_bsop_date": "20240422",
            "stck_cntg_hour": "124900",
            "stck_prpr": "275",
            "elw_oprc": "280",
            "elw_hgpr": "280",
            "elw_lwpr": "275",
            "hts_ints_vltl": "22.24",
            "hist_vltl": ""
        }
    ],
    "rt_cd": "0",
    "msg_cd": "MCA00000",
    "msg1": "정상처리 되었습니다."
}
```
