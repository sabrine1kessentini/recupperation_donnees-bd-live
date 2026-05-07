// package com.projet1.auth_service.controller;
//
// import org.junit.jupiter.api.Test;
// import org.springframework.beans.factory.annotation.Autowired;
// import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
// import org.springframework.boot.test.context.SpringBootTest;
// import org.springframework.http.MediaType;
// import org.springframework.test.web.servlet.MockMvc;
//
// import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
// import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
//
// @SpringBootTest
// @AutoConfigureMockMvc
// class AuthControllerTest {
//
//     @Autowired
//     private MockMvc mockMvc;
//
//     @Test
//     void signup_shouldReturnOk() throws Exception {
//         String json = "{" +
//                 "\"username\": \"testuser\"," +
//                 "\"email\": \"testuser@example.com\"," +
//                 "\"password\": \"testpass\"" +
//                 "}";
//         mockMvc.perform(post("/auth/signup")
//                 .contentType(MediaType.APPLICATION_JSON)
//                 .content(json))
//                 .andExpect(status().isOk());
//     }
// }
