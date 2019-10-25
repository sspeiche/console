#!/usr/bin/env bash

set -euo pipefail

CONSOLE_IMAGE=${CONSOLE_IMAGE:="quay.io/openshift/origin-console:latest"}
CONSOLE_PORT=${CONSOLE_PORT:=9000}

echo "Starting local OpenShift console..."

IS_OPENSHIFT=false
if type oc > /dev/null; then
  set +e
  oc whoami > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    IS_OPENSHIFT=true
  fi
  set -e
fi

BRIDGE_USER_AUTH="disabled"
BRIDGE_K8S_MODE="off-cluster"
BRIDGE_K8S_AUTH="bearer-token"
# FIXME: this should not be the default...
BRIDGE_K8S_MODE_OFF_CLUSTER_SKIP_VERIFY_TLS=true

if [ "$IS_OPENSHIFT" = true ]; then
  BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT=$(oc whoami --show-server)
  # FIXME: requires OpenShift 4.3+
  BRIDGE_K8S_MODE_OFF_CLUSTER_THANOS=$(oc -n openshift-monitoring get configmap sharing-config -o jsonpath='{.data.thanosURL}' 2>/dev/null || :)
  BRIDGE_K8S_MODE_OFF_CLUSTER_PROMETHEUS=$(oc -n openshift-monitoring get configmap sharing-config -o jsonpath='{.data.prometheusURL}' 2>/dev/null || :)
  BRIDGE_K8S_MODE_OFF_CLUSTER_ALERTMANAGER=$(oc -n openshift-monitoring get configmap sharing-config -o jsonpath='{.data.alertmanagerURL}' 2>/dev/null || :)
  set +e
  BRIDGE_K8S_AUTH_BEARER_TOKEN=$(oc whoami --show-token 2>/dev/null)
  STATUS="$?"
  set -e
  if [ "$STATUS" -ne 0 ]; then
    # fall back to a service account token if using certificate auth
    CONSOLE_SERVICE_ACCOUNT_NAMESPACE=${CONSOLE_SERVICE_ACCOUNT_NAMESPACE:=openshift-cluster-version}
    BRIDGE_K8S_AUTH_BEARER_TOKEN=$(oc get secret $(oc get serviceaccount default -n "$CONSOLE_SERVICE_ACCOUNT_NAMESPACE" -o jsonpath='{.secrets[0].name}') -n "$CONSOLE_SERVICE_ACCOUNT_NAMESPACE" -o jsonpath='{.data.token}' | base64 --decode )
  fi
else
  # user the service account from kube-system for auth
  CONSOLE_SERVICE_ACCOUNT_NAMESPACE=${CONSOLE_SERVICE_ACCOUNT_NAMESPACE:=kube-system}
  BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
  BRIDGE_K8S_AUTH_BEARER_TOKEN=$(kubectl get secret $(kubectl get serviceaccount default -n "$CONSOLE_SERVICE_ACCOUNT_NAMESPACE" -o jsonpath='{.secrets[0].name}') -n "$CONSOLE_SERVICE_ACCOUNT_NAMESPACE" -o jsonpath='{.data.token}' | base64 --decode )
fi

echo "API Server: $BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT"
echo "Console Image: $CONSOLE_IMAGE"
echo "Console URL: http://localhost:${CONSOLE_PORT}"
echo
docker run --rm -p "$CONSOLE_PORT":9000 --env-file <(set | grep BRIDGE) $CONSOLE_IMAGE
