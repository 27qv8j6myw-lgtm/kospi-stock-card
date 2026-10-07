# 국내주식 VI변동성완화장치

- 메뉴: [국내주식] 실시간시세
- API ID: `실시간-050` · 통신방식: WEBSOCKET
- 요청: `POST /tryitout/H0STVIC0`
- TR_ID: 실전 `-` · 모의 `-`
- 도메인: 실전 ws://ops.koreainvestment.com:21000 · 모의 -

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| approval_key | 웹소켓 접속키 | string | Y | 36 | 실시간 (웹소켓) 접속키 발급 API(/oauth2/Approval)를 사용하여 발급받은 웹소켓 접속키 |
| tr_type | 등록/해제 | string | Y | 1 | "1: 등록, 2:해제" |

## Request Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 7 | H0STVIC0 |
| tr_key | 종목코드 | string | Y | 6 | 영업일자 (20240419) |

## Response Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| **BSOP_DATE** | 영업일자 | object | Y | 8 | '각 항목사이에는 구분자로 ^ 사용,<br>모든 데이터타입은 String으로 변환되어 push 처리됨' |
| MKSC_SHRN_ISCD | 종목코드 | string | Y | 9 |  |
| HTS_KOR_ISNM | HTS한글종목명 | string | Y | 40 |  |
| MRKT_DIV_CLS_CODE | 장분류구분코드 | string | Y | 1 |  |
| VI_CLS_CODE | VI적용구분코드 | string | Y | 1 |  |
| VI_CNCL_HOUR | VI해제시각 | string | Y | 6 |  |
| CNTG_VI_HOUR | VI발동시간 | string | Y | 6 |  |
| VI_KIND_CODE | VI종류코드 | string | Y | 1 |  |
| VI_PRC | VI발동가격 | string | Y | 4 |  |
| VI_STND_PRC | 정적VI발동기준가 | string | Y | 4 |  |
| VI_DPRT | 정적VI발동괴리율 | string | Y | 8 |  |
| VI_DMC_STND_PRC | 동적VI발동기준가 | string | Y | 4 |  |
| VI_DMC_DPRT | 동적VI발동괴리율 | string | Y | 8 |  |
| VI_COUNT | VI발동횟수 | string | Y | 4 |  |
| ETP_YN | ETP 여부 | string | Y | 1 | Y : 예 N : 아니오 |

## Request Example (Python)

```json
{
    "header": {
        "approval_key": "35xxxxxa-bxxa-4xxb-87xxx-f56xxxxxxxxxx",
        "custtype": "P",
        "tr_type": "1",
        "content-type": "utf-8"
    },
    "body": {
        "input": {
            "tr_id": "H0STVIC0",
            "tr_key": "005930"
        }
    }
}
```

## Response Example

```text
# 연결 확인
{
    "header": {
        "tr_id": "H0STVIC0", 
        "tr_key": "005930", 
        "encrypt": "N"
        }, 
    "body": {
        "rt_cd": "0", 
        "msg_cd": "OPSP0000",
        "msg1": "SUBSCRIBE SUCCESS", 
        "output": {
            "iv": "0123456789abcdef", 
            "key": "abcdefghijklmnopabcdefghijklmnop"}
        }
}

# output
```
