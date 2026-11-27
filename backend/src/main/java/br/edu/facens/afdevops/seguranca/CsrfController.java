package br.edu.facens.afdevops.seguranca;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;

@RestController
class CsrfController {
    @GetMapping("/api/csrf")
    ResponseEntity<TokenCsrf> obterToken(@RequestAttribute("_csrf") CsrfToken csrf) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(new TokenCsrf(csrf.getHeaderName(), csrf.getToken()));
    }

    record TokenCsrf(String headerName, String token) {
    }
}
