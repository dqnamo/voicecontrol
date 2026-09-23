"use client";

import { ArrowRightIcon, GithubLogoIcon } from "@phosphor-icons/react";

export function ProcessArrow() {
  return (
    <ArrowRightIcon
      aria-hidden="true"
      className="process-arrow"
      size={18}
      weight="regular"
    />
  );
}

export function GitHubMark() {
  return <GithubLogoIcon aria-hidden="true" size={14} weight="fill" />;
}
