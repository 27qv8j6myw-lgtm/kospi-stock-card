# KRX야간옵션 실시간호가

- 메뉴: [국내선물옵션] 실시간시세
- API ID: `실시간-033` · 통신방식: WEBSOCKET
- 요청: `POST /tryitout/H0EUASP0`
- TR_ID: 실전 `H0EUASP0` · 모의 `-`
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
| tr_id | 거래ID | string | Y | 2 | H0EUASP0 |
| tr_key | 구분값 | string | Y | 12 | 야간옵션 종목코드 |

## Response Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| OPTN_SHRN_ISCD | 옵션단축종목코드 | string | Y | 9 |  |
| BSOP_HOUR | 영업시간 | string | Y | 6 |  |
| OPTN_ASKP1 | 옵션매도호가1 | string | Y | 1 |  |
| OPTN_ASKP2 | 옵션매도호가2 | string | Y | 1 |  |
| OPTN_ASKP3 | 옵션매도호가3 | string | Y | 1 |  |
| OPTN_ASKP4 | 옵션매도호가4 | string | Y | 1 |  |
| OPTN_ASKP5 | 옵션매도호가5 | string | Y | 1 |  |
| OPTN_BIDP1 | 옵션매수호가1 | string | Y | 1 |  |
| OPTN_BIDP2 | 옵션매수호가2 | string | Y | 1 |  |
| OPTN_BIDP3 | 옵션매수호가3 | string | Y | 1 |  |
| OPTN_BIDP4 | 옵션매수호가4 | string | Y | 1 |  |
| OPTN_BIDP5 | 옵션매수호가5 | string | Y | 1 |  |
| ASKP_CSNU1 | 매도호가건수1 | string | Y | 1 |  |
| ASKP_CSNU2 | 매도호가건수2 | string | Y | 1 |  |
| ASKP_CSNU3 | 매도호가건수3 | string | Y | 1 |  |
| ASKP_CSNU4 | 매도호가건수4 | string | Y | 1 |  |
| ASKP_CSNU5 | 매도호가건수5 | string | Y | 1 |  |
| BIDP_CSNU1 | 매수호가건수1 | string | Y | 1 |  |
| BIDP_CSNU2 | 매수호가건수2 | string | Y | 1 |  |
| BIDP_CSNU3 | 매수호가건수3 | string | Y | 1 |  |
| BIDP_CSNU4 | 매수호가건수4 | string | Y | 1 |  |
| BIDP_CSNU5 | 매수호가건수5 | string | Y | 1 |  |
| ASKP_RSQN1 | 매도호가잔량1 | string | Y | 1 |  |
| ASKP_RSQN2 | 매도호가잔량2 | string | Y | 1 |  |
| ASKP_RSQN3 | 매도호가잔량3 | string | Y | 1 |  |
| ASKP_RSQN4 | 매도호가잔량4 | string | Y | 1 |  |
| ASKP_RSQN5 | 매도호가잔량5 | string | Y | 1 |  |
| BIDP_RSQN1 | 매수호가잔량1 | string | Y | 1 |  |
| BIDP_RSQN2 | 매수호가잔량2 | string | Y | 1 |  |
| BIDP_RSQN3 | 매수호가잔량3 | string | Y | 1 |  |
| BIDP_RSQN4 | 매수호가잔량4 | string | Y | 1 |  |
| BIDP_RSQN5 | 매수호가잔량5 | string | Y | 1 |  |
| TOTAL_ASKP_CSNU | 총매도호가건수 | string | Y | 1 |  |
| TOTAL_BIDP_CSNU | 총매수호가건수 | string | Y | 1 |  |
| TOTAL_ASKP_RSQN | 총매도호가잔량 | string | Y | 1 |  |
| TOTAL_BIDP_RSQN | 총매수호가잔량 | string | Y | 1 |  |
| TOTAL_ASKP_RSQN_ICDC | 총매도호가잔량증감 | string | Y | 1 |  |
| TOTAL_BIDP_RSQN_ICDC | 총매수호가잔량증감 | string | Y | 1 |  |

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
            "tr_id": "H0EUASP0",
            "tr_key": "301V06362"
        }
    }
}
```

## Response Example

```text
# 연결 확인
{
    "header": {
        "tr_id": "H0EUASP0", 
        "tr_key": "301V06362", 
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
0|H0EUASP0|001|301V06362^190159^2.98^2.99^3.00^0.00^0.00^2.97^2.96^2.95^0.00^0.00^0
^0^0^0^0^0^0^0^0^0^1^3^12^0^0^9^21^16^0^0^0^0^16^46^5^0

# output - 복호화 후
#### 야간옵션(EUREX) 호가 ####
야간옵션(EUREX)  [301V06362]
영업시간  [190215]
====================================
옵션매도호가1   [2.98],    매도호가건수1        [0],    매도호가잔량1   [1]
옵션매도호가2   [3.00],    매도호가건수2        [0],    매도호가잔량2   [6]
옵션매도호가3   [3.01],    매도호가건수3        [0],    매도호가잔량3   [15]
옵션매도호가4   [0.00],    매도호가건수4        [0],    매도호가잔량4   [0]
옵션매도호가5   [0.00],    매도호가건수5        [0],    매도호가잔량5   [0]
옵션매수호가1   [2.97],    매수호가건수1        [0],    매수호가잔량1   [10]
옵션매수호가2   [2.96],    매수호가건수2        [0],    매수호가잔량2   [21]
옵션매수호가3   [2.95],    매수호가건수3        [0],    매수호가잔량3   [16]
옵션매수호가4   [0.00],   매수호가건수4 [0],    매수호가잔량4   [0]
옵션매수호가5   [0.00],    매수호가건수5        [0],    매수호가잔량5   [0]
====================================
총매도호가건수  [0],    총매도호가잔량  [22],    총매도호가잔량증감     [-1]
총매수호가건수  [0],    총매수호가잔량  [47],    총매수호가잔량증감     [1]
```
