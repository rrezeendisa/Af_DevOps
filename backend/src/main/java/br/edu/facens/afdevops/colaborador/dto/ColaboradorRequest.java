package br.edu.facens.afdevops.colaborador.dto;

import java.util.Locale;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ColaboradorRequest(
        @NotBlank @Size(max = 150) @Pattern(regexp = "[^\\x00]*") String nome,
        @NotBlank @Email @Size(max = 254) @Pattern(regexp = "[^\\x00]*") String email,
        @NotBlank @Size(max = 100) @Pattern(regexp = "[^\\x00]*") String cargo,
        @NotBlank @Size(max = 100) @Pattern(regexp = "[^\\x00]*") String departamento) {

    public ColaboradorRequest {
        if (email != null) {
            email = email.strip().toLowerCase(Locale.ROOT);
        }
    }
}
