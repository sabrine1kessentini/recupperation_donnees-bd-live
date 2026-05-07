package com.projet1.auth_service.domain;

import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(unique = true)
    private String email;

    private boolean enabled = true;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "user_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<Role> roles = new HashSet<>();

    // Additional fields for external API compatibility
    private String clientname;
    private String country;
    private String city;
    private Integer active = 0;
    private String phonenumber;
    private Integer numberofphones = 0;
    private String jasonpath;
    private String regiscode;
    private String lastedate;
    private String resetpasswordtoken;
    private Integer isgateway = 0;
    private String passkey;
    private String unicastadress = "0001";
    private Integer isadmin = 0;
    private String devicename;
    private String unicastlowadress = "0001";
    private Integer unicasthighadress = 0;
    private Integer grouplowadress = 0;
    private Integer grouphighadress = 0;
    private Integer scenelowadress = 0;
    private Integer scenehighadress = 0;
    private Integer sequencenumber = 0;
    private Integer ivindex = 0;
    private String mqttClientCreated;
    private String mqttClientModified;
    private String setUserAdminToken;
    private String setUserGatewayToken;
    private String mqttIP;
    private String mqttPORT;
    private String databaseIP = "iot.waveon.tn/WS_WAVEON/proxy/";
    private String databasePORT = "81";
    private String databaseUserName = "";
    private String databasePassKey = "";
    private Integer subscriptionType = 0;
    private Integer maxUserReached = 0;

    public User() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public Set<Role> getRoles() { return roles; }
    public void setRoles(Set<Role> roles) { this.roles = roles; }

    // Getters and setters for additional fields
    public String getClientname() { return clientname; }
    public void setClientname(String clientname) { this.clientname = clientname; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public Integer getActive() { return active; }
    public void setActive(Integer active) { this.active = active; }
    public String getPhonenumber() { return phonenumber; }
    public void setPhonenumber(String phonenumber) { this.phonenumber = phonenumber; }
    public Integer getNumberofphones() { return numberofphones; }
    public void setNumberofphones(Integer numberofphones) { this.numberofphones = numberofphones; }
    public String getJasonpath() { return jasonpath; }
    public void setJasonpath(String jasonpath) { this.jasonpath = jasonpath; }
    public String getRegiscode() { return regiscode; }
    public void setRegiscode(String regiscode) { this.regiscode = regiscode; }
    public String getLastedate() { return lastedate; }
    public void setLastedate(String lastedate) { this.lastedate = lastedate; }
    public String getResetpasswordtoken() { return resetpasswordtoken; }
    public void setResetpasswordtoken(String resetpasswordtoken) { this.resetpasswordtoken = resetpasswordtoken; }
    public Integer getIsgateway() { return isgateway; }
    public void setIsgateway(Integer isgateway) { this.isgateway = isgateway; }
    public String getPasskey() { return passkey; }
    public void setPasskey(String passkey) { this.passkey = passkey; }
    public String getUnicastadress() { return unicastadress; }
    public void setUnicastadress(String unicastadress) { this.unicastadress = unicastadress; }
    public Integer getIsadmin() { return isadmin; }
    public void setIsadmin(Integer isadmin) { this.isadmin = isadmin; }
    public String getDevicename() { return devicename; }
    public void setDevicename(String devicename) { this.devicename = devicename; }
    public String getUnicastlowadress() { return unicastlowadress; }
    public void setUnicastlowadress(String unicastlowadress) { this.unicastlowadress = unicastlowadress; }
    public Integer getUnicasthighadress() { return unicasthighadress; }
    public void setUnicasthighadress(Integer unicasthighadress) { this.unicasthighadress = unicasthighadress; }
    public Integer getGrouplowadress() { return grouplowadress; }
    public void setGrouplowadress(Integer grouplowadress) { this.grouplowadress = grouplowadress; }
    public Integer getGrouphighadress() { return grouphighadress; }
    public void setGrouphighadress(Integer grouphighadress) { this.grouphighadress = grouphighadress; }
    public Integer getScenelowadress() { return scenelowadress; }
    public void setScenelowadress(Integer scenelowadress) { this.scenelowadress = scenelowadress; }
    public Integer getScenehighadress() { return scenehighadress; }
    public void setScenehighadress(Integer scenehighadress) { this.scenehighadress = scenehighadress; }
    public Integer getSequencenumber() { return sequencenumber; }
    public void setSequencenumber(Integer sequencenumber) { this.sequencenumber = sequencenumber; }
    public Integer getIvindex() { return ivindex; }
    public void setIvindex(Integer ivindex) { this.ivindex = ivindex; }
    public String getMqttClientCreated() { return mqttClientCreated; }
    public void setMqttClientCreated(String mqttClientCreated) { this.mqttClientCreated = mqttClientCreated; }
    public String getMqttClientModified() { return mqttClientModified; }
    public void setMqttClientModified(String mqttClientModified) { this.mqttClientModified = mqttClientModified; }
    public String getSetUserAdminToken() { return setUserAdminToken; }
    public void setSetUserAdminToken(String setUserAdminToken) { this.setUserAdminToken = setUserAdminToken; }
    public String getSetUserGatewayToken() { return setUserGatewayToken; }
    public void setSetUserGatewayToken(String setUserGatewayToken) { this.setUserGatewayToken = setUserGatewayToken; }
    public String getMqttIP() { return mqttIP; }
    public void setMqttIP(String mqttIP) { this.mqttIP = mqttIP; }
    public String getMqttPORT() { return mqttPORT; }
    public void setMqttPORT(String mqttPORT) { this.mqttPORT = mqttPORT; }
    public String getDatabaseIP() { return databaseIP; }
    public void setDatabaseIP(String databaseIP) { this.databaseIP = databaseIP; }
    public String getDatabasePORT() { return databasePORT; }
    public void setDatabasePORT(String databasePORT) { this.databasePORT = databasePORT; }
    public String getDatabaseUserName() { return databaseUserName; }
    public void setDatabaseUserName(String databaseUserName) { this.databaseUserName = databaseUserName; }
    public String getDatabasePassKey() { return databasePassKey; }
    public void setDatabasePassKey(String databasePassKey) { this.databasePassKey = databasePassKey; }
    public Integer getSubscriptionType() { return subscriptionType; }
    public void setSubscriptionType(Integer subscriptionType) { this.subscriptionType = subscriptionType; }
    public Integer getMaxUserReached() { return maxUserReached; }
    public void setMaxUserReached(Integer maxUserReached) { this.maxUserReached = maxUserReached; }
}
