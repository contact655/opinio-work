/**
 * ★右欄（`CandidateProfilePanel`）でプロフィールを描くために、/u/[id] の中身が使う client コンポーネントを
 *   右欄を使うページの**サーバー側から**参照しておく（2026-10-11）。
 *
 * ⚠️★このファイルに "use client" を付けないこと。サーバーの部品から client コンポーネントを import したときだけ
 *    Next の React Client Manifest に載る（client の部品から import しても載らない。実際に試して載らなかった）。
 * ⚠️★右欄を使うページ（/biz/candidates・/biz/messages・/biz/messages/[id]）の page.tsx で
 *    `void PROFILE_CLIENT_MODULES;` とする。新しく右欄を使うページを足したら、そこにも書くこと。
 *
 * ⚠️ 中身はサーバー（`renderCandidateProfile` → `UserProfileContent`）で描いて返す。返ってきた中に client コンポーネントがあると、
 *    受け取るページの client の一覧（React Client Manifest）に載っていないものは描けず、
 *    「Could not find the module … in the React Client Manifest」で落ちる（実際に踏んだ）。
 * ⚠️★`UserProfileContent` に client コンポーネントを足したら、ここにも足すこと。足し忘れると右欄だけ「読み込めませんでした」になる
 *    （/u/[id] は普通に出るので気づきにくい）。
 */
import { CandidateNotesPanel } from "@/components/candidateNotes/CandidateNotesPanel";
import MergedTimeline from "@/components/profile/MergedTimeline";
import SchoolLogoImg from "@/components/profile/SchoolLogoImg";
import { ProfileShareButton } from "@/components/profile/ProfileShareButton";
import { FollowUserButton } from "@/app/(jobseeker)/u/[id]/FollowUserButton";
import { DMButton } from "@/components/profile/DMButton";
import { ApproachButton } from "@/components/approaches/ApproachButton";
import { ProfileMoreMenu } from "@/components/profile/ProfileMoreMenu";
import * as ProfileSections from "@/components/profile/view/ProfileSections";
import CompanyLogoImg from "@/components/profile/CompanyLogoImg";

export const PROFILE_CLIENT_MODULES = [
  CandidateNotesPanel, MergedTimeline, SchoolLogoImg, ProfileShareButton, FollowUserButton, DMButton,
  ApproachButton, ProfileMoreMenu, ProfileSections, CompanyLogoImg,
] as const;
