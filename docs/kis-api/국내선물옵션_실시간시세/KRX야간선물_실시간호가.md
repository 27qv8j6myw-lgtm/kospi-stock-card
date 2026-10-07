# KRX야간선물 실시간호가

- 메뉴: [국내선물옵션] 실시간시세
- API ID: `실시간-065` · 통신방식: WEBSOCKET
- 요청: `POST /tryitout/H0MFASP0`
- TR_ID: 실전 `H0MFASP0` · 모의 `-`
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
| tr_id | 거래ID | string | Y | 2 | H0MFASP0 |
| tr_key | 구분값 | string | Y | 12 | 야간선물 종목코드 |

## Response Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FUTS_SHRN_ISCD | 선물 단축 종목코드 | string | Y | 9 |  |
| BSOP_HOUR | 영업 시간 | string | Y | 6 |  |
| FUTS_ASKP1 | 선물 매도호가1 | string | Y | 8 |  |
| FUTS_ASKP2 | 선물 매도호가2 | string | Y | 8 |  |
| FUTS_ASKP3 | 선물 매도호가3 | string | Y | 8 |  |
| FUTS_ASKP4 | 선물 매도호가4 | string | Y | 8 |  |
| FUTS_ASKP5 | 선물 매도호가5 | string | Y | 8 |  |
| FUTS_BIDP1 | 선물 매수호가1 | string | Y | 8 |  |
| FUTS_BIDP2 | 선물 매수호가2 | string | Y | 8 |  |
| FUTS_BIDP3 | 선물 매수호가3 | string | Y | 8 |  |
| FUTS_BIDP4 | 선물 매수호가4 | string | Y | 8 |  |
| FUTS_BIDP5 | 선물 매수호가5 | string | Y | 8 |  |
| ASKP_CSNU1 | 매도호가 건수1 | string | Y | 4 |  |
| ASKP_CSNU2 | 매도호가 건수2 | string | Y | 4 |  |
| ASKP_CSNU3 | 매도호가 건수3 | string | Y | 4 |  |
| ASKP_CSNU4 | 매도호가 건수4 | string | Y | 4 |  |
| ASKP_CSNU5 | 매도호가 건수5 | string | Y | 4 |  |
| BIDP_CSNU1 | 매수호가 건수1 | string | Y | 4 |  |
| BIDP_CSNU2 | 매수호가 건수2 | string | Y | 4 |  |
| BIDP_CSNU3 | 매수호가 건수3 | string | Y | 4 |  |
| BIDP_CSNU4 | 매수호가 건수4 | string | Y | 4 |  |
| BIDP_CSNU5 | 매수호가 건수5 | string | Y | 4 |  |
| ASKP_RSQN1 | 매도호가 잔량1 | string | Y | 8 |  |
| ASKP_RSQN2 | 매도호가 잔량2 | string | Y | 8 |  |
| ASKP_RSQN3 | 매도호가 잔량3 | string | Y | 8 |  |
| ASKP_RSQN4 | 매도호가 잔량4 | string | Y | 8 |  |
| ASKP_RSQN5 | 매도호가 잔량5 | string | Y | 8 |  |
| BIDP_RSQN1 | 매수호가 잔량1 | string | Y | 8 |  |
| BIDP_RSQN2 | 매수호가 잔량2 | string | Y | 8 |  |
| BIDP_RSQN3 | 매수호가 잔량3 | string | Y | 8 |  |
| BIDP_RSQN4 | 매수호가 잔량4 | string | Y | 8 |  |
| BIDP_RSQN5 | 매수호가 잔량5 | string | Y | 8 |  |
| TOTAL_ASKP_CSNU | 총 매도호가 건수 | string | Y | 4 |  |
| TOTAL_BIDP_CSNU | 총 매수호가 건수 | string | Y | 4 |  |
| TOTAL_ASKP_RSQN | 총 매도호가 잔량 | string | Y | 8 |  |
| TOTAL_BIDP_RSQN | 총 매수호가 잔량 | string | Y | 8 |  |
| TOTAL_ASKP_RSQN_ICDC | 총 매도호가 잔량 증감 | string | Y | 4 |  |
| TOTAL_BIDP_RSQN_ICDC | 총 매수호가 잔량 증감 | string | Y | 4 |  |

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
            "tr_id": "H0MFASP0",
            "tr_key": "101V06"
        }
    }
}
```

## Response Example

```text
# 연결 확인
{
    "header": {
        "tr_id": "H0MFASP0", 
        "tr_key": "101V06", 
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
0|H0MFASP0|001|101V06^190215^367.35^367.40^367.45^0.00^0.00^367.30^367.25^367.20^0.
00^0.00^0^0^0^0^0^0^0^0^0^0^24^21^21^0^0^2^28^20^0^0^0^0^0^0^^0^0^0^0^0^^000000^2^
```
