# 접근토큰폐기(P)

- 메뉴: OAuth인증
- API ID: `인증-002` · 통신방식: REST
- 요청: `POST /oauth2/revokeP`
- TR_ID: 실전 `-` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 https://openapivts.koreainvestment.com:29443

## 개요

부여받은 접큰토큰을 더 이상 활용하지 않을 때 사용합니다.

## Request Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| appkey | 고객 앱Key | string | Y | 36 | 한국투자증권 홈페이지에서 발급받은 appkey (절대 노출되지 않도록 주의해주세요.) |
| appsecret | 고객 앱Secret | string | Y | 180 | 한국투자증권 홈페이지에서 발급받은 appsecret (절대 노출되지 않도록 주의해주세요.) |
| token | 접근토큰 | string | Y | 286 | OAuth 토큰이 필요한 API 경우 발급한 Access token<br>일반고객(Access token 유효기간 1일, OAuth 2.0의 Client Credentials Grant 절차를 준용)<br>법인(Access token 유효기간 3개월, Refresh token 유효기간 1년, OAuth 2.0의 Authorization Code Grant 절차를 준용) |

## Response Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| code | 응답코드 | string | N | 8 | HTTP 응답코드 |
| message | 응답메세지 | string | N | 450 | 응답메세지 |

## Request Example (Python)

```json
{
  "appkey" : "PSw2UvBQCpoZFc7nZpIfIrOttmXXXXXXXXXX",
  "appsecret" : "/g84gaZp7W3DJEZhamiTH8ZdJkUJ8603rjo3HcOm5PvIc1YC3YmyJOQoW1H0kNjo4IbHwGUdi3+9oEbH4RKKl8GnEu3n/khxm0OrwHkQur+wbA74fcFXxaUnEbftu0X72Eaw9dEBMuK3rODeeOanrsJ1kZ9oKWykIG04F0nmgdXXXXXXXXXX",
  "token" : "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJ0b2tlbiIsImF1ZCI6IjZmNDgxMjBiLTlmMDItNGI5ZS05MGExLTRiNDk2MGM5ZWY2MyIsImlzcyI6InVub2d3IiwiZXhwIjoxNjQzMjg2MDUzLCJpYXQiOjE2NDMxOTk2NTMsImp0aSI6IlBTdzJVdkJRQ3dvWkZhOG5acElmSXJPdHRtZUtLUGZCclNKcyJ9.6Z-UvArobBfXbnpSFbFhd9WPVEM3ZQa5NEpqfmQ6rrZBISCi-P9CEamfVReIduTVYbafF02Pl6EPXXXXXXXXXX"
}
```

## Response Example

```json
{
  "code" : 200,
  "message" : "접근토큰 폐기에 성공하였습니다"
}
```
