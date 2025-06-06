from urllib.request import urlopen, Request
import importlib
import mimetypes
import os
import re
# import sys
import tempfile
import xml.etree.ElementTree as ET
from pikepdf import Pdf
from PIL import Image
from docassemble.base.generate_key import random_lower_string
from docassemble.base.logger import logmessage
from docassemble.base.error import DAException
import docassemble.base.config
import docassemble.base.functions
from docassemble.webapp.core.models import Uploads, UploadsUserAuth, UploadsRoleAuth
from docassemble.webapp.db_object import db
from docassemble.webapp.files import SavedFile, get_ext_and_mimetype
from docassemble.webapp.users.models import UserDictKeys, UserRoles
import docassemble.webapp.cloud
from flask import session, url_for
from flask_login import current_user
from sqlalchemy import and_, select

cloud = docassemble.webapp.cloud.get_cloud()

QPDF_PATH = 'qpdf'


def url_if_exists(file_reference, **kwargs):
    attach_parameter = '&attachment=1' if kwargs.get('_attachment', False) else ''
    parts = file_reference.split(":")
    base_url = url_for('rootindex', _external=kwargs.get('_external', False)).rstrip('/')
    if len(parts) == 2:
        if cloud and docassemble.base.config.daconfig.get('use cloud urls', False):
            m = re.search(r'^docassemble\.playground([0-9]+)(.*)$', parts[0])
            if m:
                user_id = m.group(1)
                project = m.group(2)
                if re.search(r'^data/sources/', parts[1]):
                    section = 'playgroundsources'
                    filename = re.sub(r'^data/sources/', '', parts[1])
                    filename = re.sub(r'[^A-Za-z0-9\-\_\. ]', '', filename)
                    if project == '':
                        key = str(section) + '/' + str(user_id) + '/' + filename
                    else:
                        key = str(section) + '/' + str(user_id) + '/' + project + '/' + filename
                    cloud_key = cloud.get_key(key)
                    if cloud_key.does_exist:
                        if kwargs.get('_attachment', False):
                            return cloud_key.generate_url(3600, display_filename=filename)
                        return cloud_key.generate_url(3600)
                    return None
                section = 'playgroundstatic'
                filename = re.sub(r'^data/static/', '', parts[1])
                version_parameter = get_version_parameter(parts[0])
                return base_url + '/packagestatic/' + parts[0] + '/' + re.sub(r'^data/static/', '', parts[1]) + version_parameter + attach_parameter
        the_path = docassemble.base.functions.static_filename_path(file_reference)
        if the_path is None or not os.path.isfile(the_path):
            return None
        version_parameter = get_version_parameter(parts[0])
        return base_url + '/packagestatic/' + parts[0] + '/' + re.sub(r'^data/static/', '', parts[1]) + version_parameter + attach_parameter
    return None


def get_version_parameter(package):
    try:
        return '?v=' + str(importlib.import_module(package).__version__)
    except:
        if package.startswith('docassemble.playground'):
            return '?v=' + random_lower_string(6)
        return ''


def get_info_from_file_reference(file_reference, **kwargs):
    # logmessage('file reference is ' + str(file_reference))
    convert = kwargs.get('convert', None)
    privileged = kwargs.get('privileged', None)
    return_nonexistent = kwargs.get('return_nonexistent', False)
    has_info = False
    if re.search(r'^[0-9]+$', str(file_reference)):
        uids = kwargs.get('uids', None)
        if uids is None or len(uids) == 0:
            new_uid = docassemble.base.functions.get_uid()
            if new_uid is not None:
                uids = [new_uid]
            else:
                uids = []
        if 'filename' in kwargs:
            result = get_info_from_file_number(int(file_reference), privileged=privileged, filename=kwargs['filename'], uids=uids)
        else:
            result = get_info_from_file_number(int(file_reference), privileged=privileged, uids=uids)
        if 'fullpath' not in result:
            result['fullpath'] = None
        has_info = True
    elif re.search(r'^https?://', str(file_reference)):
        # logmessage("get_info_from_file_reference: " + str(file_reference) + " is a URL")
        possible_filename = re.sub(r'.*/', '', file_reference)
        if possible_filename == '':
            possible_filename = 'index.html'
        if re.search(r'\.', possible_filename):
            (possible_ext, possible_mimetype) = get_ext_and_mimetype(possible_filename)
            possible_ext = re.sub(r'[^A-Za-z0-9\.].*', '', possible_ext)
            # logmessage("get_info_from_file_reference: starting with " + str(possible_ext) + " and " + str(possible_mimetype))
        else:
            possible_ext = 'txt'
            possible_mimetype = 'text/plain'
        result = {}
        temp_file = tempfile.NamedTemporaryFile(prefix="datemp", suffix='.' + possible_ext, delete=False)
        req = Request(file_reference, headers={'User-Agent': docassemble.base.config.daconfig.get('user agent', 'curl/7.64.0')})
        response = urlopen(req)
        temp_file.write(response.read())
        # (local_filename, headers) = urllib.urlretrieve(file_reference)
        result['fullpath'] = temp_file.name
        try:
            # result['mimetype'] = headers.gettype()
            result['mimetype'] = response.headers['Content-Type']
            # logmessage("get_info_from_file_reference: mimetype is " + str(result['mimetype']))
        except:
            logmessage("get_info_from_file_reference: could not get mimetype from headers")
            result['mimetype'] = possible_mimetype
            result['extension'] = possible_ext
        if 'extension' not in result:
            # logmessage("get_info_from_file_reference: extension not in result")
            result['extension'] = re.sub(r'^\.', '', mimetypes.guess_extension(result['mimetype']))
            # logmessage("get_info_from_file_reference: extension is " + str(result['extension']))
        if re.search(r'\.', possible_filename):
            result['filename'] = possible_filename
        else:
            result['filename'] = possible_filename + '.' + result['extension']
        path_parts = os.path.splitext(result['fullpath'])
        result['path'] = path_parts[0]
        has_info = True
        # logmessage("get_info_from_file_reference: downloaded to " + str(result['fullpath']))
    else:
        # logmessage(str(file_reference) + " is not a URL")
        result = {}
        question = kwargs.get('question', None)
        manual_package = kwargs.get('package', None)
        folder = kwargs.get('folder', None)
        the_package = None
        parts = file_reference.split(':')
        if len(parts) == 1:
            the_package = None
            if question is not None:
                the_package = question.from_source.package
            elif manual_package is not None:
                the_package = manual_package
            if the_package is None:
                the_package = docassemble.base.functions.get_current_package()
            if folder is None:
                m = re.search(r'^data/(templates|sources|static)/(.*)', file_reference)
                if m:
                    folder = m.group(1)
                    file_reference = m.group(2)
            if folder is not None and not re.search(r'/', file_reference):
                file_reference = 'data/' + str(folder) + '/' + file_reference
            if the_package is not None:
                # logmessage("package is " + str(the_package))
                file_reference = the_package + ':' + file_reference
            else:
                # logmessage("package was null")
                file_reference = 'docassemble.base:' + file_reference
            if the_package is not None:
                result['package'] = the_package
        elif len(parts) == 2:
            result['package'] = parts[0]
        result['fullpath'] = docassemble.base.functions.static_filename_path(file_reference, return_nonexistent=return_nonexistent)
    # logmessage("path is " + str(result['fullpath']))
    if result['fullpath'] is not None:  # os.path.isfile(result['fullpath'])
        if not has_info:
            result['filename'] = os.path.basename(result['fullpath'])
            ext_type, result['mimetype'] = get_ext_and_mimetype(result['fullpath'])  # pylint: disable=unused-variable
            path_parts = os.path.splitext(result['fullpath'])
            result['path'] = path_parts[0]
            result['extension'] = path_parts[1].lower()
            result['extension'] = re.sub(r'\.', '', result['extension'])
        # logmessage("Extension is " + result['extension'])
        if convert is not None and result['extension'] in convert:
            # logmessage("Converting...")
            if os.path.isfile(result['path'] + '.' + convert[result['extension']]):
                # logmessage("Found conversion file ")
                result['extension'] = convert[result['extension']]
                result['fullpath'] = result['path'] + '.' + result['extension']
                ext_type, result['mimetype'] = get_ext_and_mimetype(result['fullpath'])
            else:
                logmessage("Did not find file " + result['path'] + '.' + convert[result['extension']])
                return {}
        # logmessage("Full path is " + result['fullpath'])
        if os.path.isfile(result['fullpath']) and not has_info:
            add_info_about_file(result['fullpath'], result['path'], result)
    else:
        logmessage("File reference " + str(file_reference) + " DID NOT EXIST.")
    return result


def add_info_about_file(filename, basename, result):
    if result['extension'] == 'pdf':
        try:
            with Pdf.open(filename) as reader:
                result['encrypted'] = reader.is_encrypted
                try:
                    if '/AcroForm' in reader.trailer['/Root']:
                        result['acroform'] = True
                    else:
                        result['acroform'] = False
                except:
                    result['acroform'] = False
                result['pages'] = len(reader.pages)
        except:
            result['pages'] = 1
    elif os.path.isfile(basename + '.pdf'):
        try:
            with Pdf.open(basename + '.pdf') as reader:
                result['encrypted'] = reader.is_encrypted
                try:
                    if '/AcroForm' in reader.trailer['/Root']:
                        result['acroform'] = True
                    else:
                        result['acroform'] = False
                except:
                    result['acroform'] = False
                result['pages'] = len(reader.pages)
        except:
            result['pages'] = 1
    elif result['extension'] in ['png', 'jpg', 'gif']:
        im = Image.open(filename)
        result['width'], result['height'] = im.size
    elif result['extension'] == 'svg':
        try:
            tree = ET.parse(filename)
            root = tree.getroot()
            viewBox = root.attrib.get('viewBox', None)
            if viewBox is not None:
                dimen = viewBox.split(' ')
                if len(dimen) == 4:
                    result['width'] = float(dimen[2]) - float(dimen[0])
                    result['height'] = float(dimen[3]) - float(dimen[1])
        except:
            raise DAException("problem reading " + str(filename))
            # logmessage('add_info_about_file: could not read ' + str(filename))


def get_info_from_file_number(file_number, privileged=False, filename=None, uids=None):
    if current_user and current_user.is_authenticated and current_user.has_role('admin', 'developer', 'advocate', 'trainer'):
        privileged = True
    elif uids is None or len(uids) == 0:
        new_uid = docassemble.base.functions.get_uid()
        if new_uid is not None:
            uids = [new_uid]
        else:
            uids = []
    result = {}
    upload = db.session.execute(select(Uploads).filter_by(indexno=file_number)).scalar()
    if not privileged and upload is not None and upload.private and upload.key not in uids:
        has_access = False
        if current_user and current_user.is_authenticated:
            if db.session.execute(select(UserDictKeys).filter_by(key=upload.key, user_id=current_user.id)).first() or db.session.execute(select(UploadsUserAuth).filter_by(uploads_indexno=file_number, user_id=current_user.id)).first() or db.session.execute(select(UploadsRoleAuth.id).join(UserRoles, and_(UserRoles.user_id == current_user.id, UploadsRoleAuth.role_id == UserRoles.role_id)).where(UploadsRoleAuth.uploads_indexno == file_number)).first():
                has_access = True
        elif session and 'tempuser' in session:
            temp_user_id = int(session['tempuser'])
            if db.session.execute(select(UserDictKeys).filter_by(key=upload.key, temp_user_id=temp_user_id)).first() or db.session.execute(select(UploadsUserAuth).filter_by(uploads_indexno=file_number, temp_user_id=temp_user_id)).first():
                has_access = True
        if not has_access:
            upload = None
    if upload:
        if filename is None:
            result['filename'] = upload.filename
        else:
            result['filename'] = filename
        result['extension'], result['mimetype'] = get_ext_and_mimetype(result['filename'])
        sf = SavedFile(file_number, extension=result['extension'], fix=True)
        result['path'] = sf.path
        result['fullpath'] = result['path'] + '.' + result['extension']
        result['private'] = upload.private
        result['persistent'] = upload.persistent
        # logmessage("fullpath is " + str(result['fullpath']))
    if 'path' not in result:
        logmessage("get_info_from_file_number: path is not in result for " + str(file_number))
        return result
    final_filename = result['path'] + '.' + result['extension']
    if os.path.isfile(final_filename):
        add_info_about_file(final_filename, result['path'], result)
    # else:
    #     logmessage("Filename " + final_filename + "did not exist.")
    return result
