# ETF 현재가 호가

- 메뉴: [국내주식] 기본시세
- API ID: `ETF 현재가 호가` · 통신방식: REST
- 요청: `GET /uapi/etfetn/v1/quotations/inquire-asking-price`
- TR_ID: 실전 `FHPST02400200` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

국내주식 ETF 현재가 호가 API입니다.
해당 API는 고객 개인 유량과 무관하게 초당 120 건 호출 제한을 두고 있어,
이용 시 호출 제한이 있사오니 참고 부탁드립니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPST02400200 |
| tr_cont | 연속 거래 여부 | string | N | 1 | 공백 : 초기 조회 <br>N : 다음 데이터 조회 (output header의 tr_cont가 M일 경우) |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건 시장 분류 코드 | string | Y | 2 | J |
| FID_INPUT_ISCD | 입력 종목코드 | string | Y | 12 | 종목번호 (6자리) |

## Response Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | 요청한 tr_id |
| tr_cont | 연속 거래 여부 | string | N | 1 | 공백 : 초기 조회 <br>N : 다음 데이터 조회 (output header의 tr_cont가 M일 경우) |

## Response Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| rt_cd | 성공 실패 여부 | string | Y | 1 |  |
| msg_cd | 응답코드 | string | Y | 8 |  |
| msg1 | 응답메세지 | string | Y | 80 |  |
| **output** | 응답상세 | object | Y |  |  |
| aspr_acpt_hour | 호가 접수 시간 | string | Y | 10 |  |
| askp1 | 매도호가1 | string | Y | 10 |  |
| askp2 | 매도호가2 | string | Y | 10 |  |
| askp3 | 매도호가3 | string | Y | 10 |  |
| askp4 | 매도호가4 | string | Y | 10 |  |
| askp5 | 매도호가5 | string | Y | 10 |  |
| askp6 | 매도호가6 | string | Y | 10 |  |
| askp7 | 매도호가7 | string | Y | 10 |  |
| askp8 | 매도호가8 | string | Y | 10 |  |
| askp9 | 매도호가9 | string | Y | 10 |  |
| askp10 | 매도호가10 | string | Y | 10 |  |
| bidp1 | 매수호가1 | string | Y | 10 |  |
| bidp2 | 매수호가2 | string | Y | 10 |  |
| bidp3 | 매수호가3 | string | Y | 10 |  |
| bidp4 | 매수호가4 | string | Y | 10 |  |
| bidp5 | 매수호가5 | string | Y | 10 |  |
| bidp6 | 매수호가6 | string | Y | 10 |  |
| bidp7 | 매수호가7 | string | Y | 10 |  |
| bidp8 | 매수호가8 | string | Y | 10 |  |
| bidp9 | 매수호가9 | string | Y | 10 |  |
| bidp10 | 매수호가10 | string | Y | 12 |  |
| askp_rsqn1 | 매도호가 잔량1 | string | Y | 12 |  |
| askp_rsqn2 | 매도호가 잔량2 | string | Y | 12 |  |
| askp_rsqn3 | 매도호가 잔량3 | string | Y | 12 |  |
| askp_rsqn4 | 매도호가 잔량4 | string | Y | 12 |  |
| askp_rsqn5 | 매도호가 잔량5 | string | Y | 12 |  |
| askp_rsqn6 | 매도호가 잔량6 | string | Y | 12 |  |
| askp_rsqn7 | 매도호가 잔량7 | string | Y | 12 |  |
| askp_rsqn8 | 매도호가 잔량8 | string | Y | 12 |  |
| askp_rsqn9 | 매도호가 잔량9 | string | Y | 12 |  |
| askp_rsqn10 | 매도호가 잔량10 | string | Y | 12 |  |
| bidp_rsqn1 | 매수호가 잔량1 | string | Y | 12 |  |
| bidp_rsqn2 | 매수호가 잔량2 | string | Y | 12 |  |
| bidp_rsqn3 | 매수호가 잔량3 | string | Y | 12 |  |
| bidp_rsqn4 | 매수호가 잔량4 | string | Y | 12 |  |
| bidp_rsqn5 | 매수호가 잔량5 | string | Y | 12 |  |
| bidp_rsqn6 | 매수호가 잔량6 | string | Y | 12 |  |
| bidp_rsqn7 | 매수호가 잔량7 | string | Y | 12 |  |
| bidp_rsqn8 | 매수호가 잔량8 | string | Y | 12 |  |
| bidp_rsqn9 | 매수호가 잔량9 | string | Y | 12 |  |
| bidp_rsqn10 | 매수호가 잔량10 | string | Y | 10 |  |
| askp_rsqn_icdc1 | 매도호가 잔량 증감1 | string | Y | 10 |  |
| askp_rsqn_icdc2 | 매도호가 잔량 증감2 | string | Y | 10 |  |
| askp_rsqn_icdc3 | 매도호가 잔량 증감3 | string | Y | 10 |  |
| askp_rsqn_icdc4 | 매도호가 잔량 증감4 | string | Y | 10 |  |
| askp_rsqn_icdc5 | 매도호가 잔량 증감5 | string | Y | 10 |  |
| askp_rsqn_icdc6 | 매도호가 잔량 증감6 | string | Y | 10 |  |
| askp_rsqn_icdc7 | 매도호가 잔량 증감7 | string | Y | 10 |  |
| askp_rsqn_icdc8 | 매도호가 잔량 증감8 | string | Y | 10 |  |
| askp_rsqn_icdc9 | 매도호가 잔량 증감9 | string | Y | 10 |  |
| askp_rsqn_icdc10 | 매도호가 잔량 증감10 | string | Y | 10 |  |
| bidp_rsqn_icdc1 | 매수호가 잔량 증감1 | string | Y | 10 |  |
| bidp_rsqn_icdc2 | 매수호가 잔량 증감2 | string | Y | 10 |  |
| bidp_rsqn_icdc3 | 매수호가 잔량 증감3 | string | Y | 10 |  |
| bidp_rsqn_icdc4 | 매수호가 잔량 증감4 | string | Y | 10 |  |
| bidp_rsqn_icdc5 | 매수호가 잔량 증감5 | string | Y | 10 |  |
| bidp_rsqn_icdc6 | 매수호가 잔량 증감6 | string | Y | 10 |  |
| bidp_rsqn_icdc7 | 매수호가 잔량 증감7 | string | Y | 10 |  |
| bidp_rsqn_icdc8 | 매수호가 잔량 증감8 | string | Y | 10 |  |
| bidp_rsqn_icdc9 | 매수호가 잔량 증감9 | string | Y | 10 |  |
| bidp_rsqn_icdc10 | 매수호가 잔량 증감10 | string | Y | 12 |  |
| total_askp_rsqn | 총 매도호가 잔량 | string | Y | 12 |  |
| total_bidp_rsqn | 총 매수호가 잔량 | string | Y | 10 |  |
| total_askp_rsqn_icdc | 총 매도호가 잔량 증감 | string | Y | 10 |  |
| total_bidp_rsqn_icdc | 총 매수호가 잔량 증감 | string | Y | 10 |  |
| ovtm_total_askp_icdc | 시간외 총 매도호가 증감 | string | Y | 10 |  |
| ovtm_total_bidp_icdc | 시간외 총 매수호가 증감 | string | Y | 12 |  |
| ovtm_total_askp_rsqn | 시간외 총 매도호가 잔량 | string | Y | 12 |  |
| ovtm_total_bidp_rsqn | 시간외 총 매수호가 잔량 | string | Y | 12 |  |
| ntby_aspr_rsqn | 순매수 호가 잔량 | string | Y | 2 |  |
| new_mkop_cls_code | 신 장운영 구분 코드 | string | Y | 12 |  |
| lp_askp_rsqn1 | LP 매도호가 잔량1 | string | Y | 12 |  |
| lp_askp_rsqn2 | LP 매도호가 잔량2 | string | Y | 12 |  |
| lp_askp_rsqn3 | LP 매도호가 잔량3 | string | Y | 12 |  |
| lp_askp_rsqn4 | LP 매도호가 잔량4 | string | Y | 12 |  |
| lp_askp_rsqn5 | LP 매도호가 잔량5 | string | Y | 12 |  |
| lp_askp_rsqn6 | LP 매도호가 잔량6 | string | Y | 12 |  |
| lp_askp_rsqn7 | LP 매도호가 잔량7 | string | Y | 12 |  |
| lp_askp_rsqn8 | LP 매도호가 잔량8 | string | Y | 12 |  |
| lp_askp_rsqn9 | LP 매도호가 잔량9 | string | Y | 12 |  |
| lp_askp_rsqn10 | LP 매도호가 잔량10 | string | Y | 12 |  |
| lp_bidp_rsqn1 | LP 매수호가 잔량1 | string | Y | 12 |  |
| lp_bidp_rsqn2 | LP 매수호가 잔량2 | string | Y | 12 |  |
| lp_bidp_rsqn3 | LP 매수호가 잔량3 | string | Y | 12 |  |
| lp_bidp_rsqn4 | LP 매수호가 잔량4 | string | Y | 12 |  |
| lp_bidp_rsqn5 | LP 매수호가 잔량5 | string | Y | 12 |  |
| lp_bidp_rsqn6 | LP 매수호가 잔량6 | string | Y | 12 |  |
| lp_bidp_rsqn7 | LP 매수호가 잔량7 | string | Y | 12 |  |
| lp_bidp_rsqn8 | LP 매수호가 잔량8 | string | Y | 12 |  |
| lp_bidp_rsqn9 | LP 매수호가 잔량9 | string | Y | 12 |  |
| lp_bidp_rsqn10 | LP 매수호가 잔량10 | string | Y | 12 |  |
| lp_total_askp_rsqn | LP 총 매도호가 잔량 | string | Y | 12 |  |
| lp_total_bidp_rsqn | LP 총 매수호가 잔량 | string | Y | 10 |  |
| mid_prc | KRX 중간가 | string | Y | 12 |  |
| midp_total_rsqn | KRX 중간가잔량합계수량 | string | Y | 1 |  |
| midp_cls_code | KRX 중간가구분코드 | string | Y | 10 |  |
| mid_prc2 | NXT 중간가 | string | Y | 12 | 미사용 필드 |
| midp_total_rsqn2 | NXT 중간가잔량합계수량 | string | Y | 1 | 미사용 필드 |
| midp_cls_code2 | NXT 중간가구분코드 | string | Y | 40 | 미사용 필드 |
